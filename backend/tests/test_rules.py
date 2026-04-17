"""Tests for auto-categorisation rules CRUD and matching logic."""
import pytest
from budget.backend.routers.rules import apply_rules
from budget.backend.models import Rule, Category, CategoryGroup


class TestListRules:
    def test_empty_list(self, client, auth_headers):
        resp = client.get("/api/rules", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_with_rules(self, client, auth_headers, sample_rule):
        resp = client.get("/api/rules", headers=auth_headers)
        data = resp.json()
        assert len(data) == 1
        assert data[0]["match_pattern"] == "TESCO"
        assert data[0]["match_type"] == "contains"
        assert data[0]["category_name"] == "Groceries"

    def test_matched_count(self, client, auth_headers, sample_rule, sample_transaction):
        """Rule listing shows how many transactions it matched."""
        resp = client.get("/api/rules", headers=auth_headers)
        data = resp.json()
        # sample_transaction has rule_id=None by default, so matched_count should be 0
        # unless we explicitly set rule_id
        assert data[0]["matched_count"] == 0


class TestCreateRule:
    def test_create_contains(self, client, auth_headers, sample_category):
        resp = client.post("/api/rules", json={
            "match_pattern": "ALDI",
            "match_type": "contains",
            "category_id": sample_category.id,
            "default_tier": "Essential",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["match_pattern"] == "ALDI"
        assert data["match_type"] == "contains"
        assert data["default_tier"] == "Essential"

    def test_create_starts_with(self, client, auth_headers, sample_category):
        resp = client.post("/api/rules", json={
            "match_pattern": "AMAZON",
            "match_type": "starts_with",
            "category_id": sample_category.id,
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["match_type"] == "starts_with"

    def test_create_exact(self, client, auth_headers, sample_category):
        resp = client.post("/api/rules", json={
            "match_pattern": "NETFLIX.COM",
            "match_type": "exact",
            "category_id": sample_category.id,
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["match_type"] == "exact"

    def test_create_invalid_match_type(self, client, auth_headers, sample_category):
        """Invalid match_type returns 400."""
        resp = client.post("/api/rules", json={
            "match_pattern": "NOPE",
            "match_type": "regex",
            "category_id": sample_category.id,
        }, headers=auth_headers)
        assert resp.status_code == 400
        assert "match_type" in resp.json()["detail"].lower()

    def test_create_invalid_category(self, client, auth_headers):
        """Non-existent category returns 404."""
        resp = client.post("/api/rules", json={
            "match_pattern": "GHOST",
            "match_type": "contains",
            "category_id": 9999,
        }, headers=auth_headers)
        assert resp.status_code == 404


class TestUpdateRule:
    def test_update_pattern(self, client, auth_headers, sample_rule):
        resp = client.put(f"/api/rules/{sample_rule.id}", json={
            "match_pattern": "TESCO STORES",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["match_pattern"] == "TESCO STORES"

    def test_update_match_type(self, client, auth_headers, sample_rule):
        resp = client.put(f"/api/rules/{sample_rule.id}", json={
            "match_type": "exact",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["match_type"] == "exact"

    def test_update_nonexistent(self, client, auth_headers):
        resp = client.put("/api/rules/9999", json={"match_pattern": "X"}, headers=auth_headers)
        assert resp.status_code == 404


class TestDeleteRule:
    def test_delete(self, client, auth_headers, sample_rule):
        resp = client.delete(f"/api/rules/{sample_rule.id}", headers=auth_headers)
        assert resp.status_code == 200
        listing = client.get("/api/rules", headers=auth_headers)
        assert listing.json() == []

    def test_delete_nonexistent(self, client, auth_headers):
        resp = client.delete("/api/rules/9999", headers=auth_headers)
        assert resp.status_code == 404

    def test_delete_clears_rule_id_on_transactions(self, client, auth_headers, db_session, sample_rule):
        """Deleting a rule sets rule_id to NULL on matched transactions."""
        from budget.backend.models import Transaction, Account
        acct = Account(bank_name="X", account_name="Y")
        db_session.add(acct)
        db_session.flush()
        tx = Transaction(
            account_id=acct.id, date="2025-01-01", description="TESCO",
            amount=-10, direction="out", rule_id=sample_rule.id,
        )
        db_session.add(tx)
        db_session.commit()

        client.delete(f"/api/rules/{sample_rule.id}", headers=auth_headers)
        db_session.refresh(tx)
        assert tx.rule_id is None


class TestApplyRules:
    """Direct unit tests for the apply_rules() matching function."""

    def _make_rule(self, db, pattern, match_type, category):
        rule = Rule(match_pattern=pattern, match_type=match_type, category_id=category.id)
        db.add(rule)
        db.commit()
        db.refresh(rule)
        return rule

    def _make_category(self, db, name="TestCat"):
        group = CategoryGroup(name=f"Group-{name}")
        db.add(group)
        db.flush()
        cat = Category(group_id=group.id, name=name)
        db.add(cat)
        db.commit()
        db.refresh(cat)
        return cat

    def test_contains_match(self, db_session):
        cat = self._make_category(db_session)
        self._make_rule(db_session, "TESCO", "contains", cat)
        matches = apply_rules(db_session, "TESCO STORES 6224")
        assert len(matches) == 1
        assert matches[0].category_id == cat.id

    def test_contains_no_match(self, db_session):
        cat = self._make_category(db_session)
        self._make_rule(db_session, "TESCO", "contains", cat)
        matches = apply_rules(db_session, "ALDI SUPERMARKET")
        assert len(matches) == 0

    def test_starts_with_match(self, db_session):
        cat = self._make_category(db_session)
        self._make_rule(db_session, "AMAZON", "starts_with", cat)
        matches = apply_rules(db_session, "AMAZON PRIME SUBSCRIPTION")
        assert len(matches) == 1

    def test_starts_with_no_match(self, db_session):
        cat = self._make_category(db_session)
        self._make_rule(db_session, "AMAZON", "starts_with", cat)
        matches = apply_rules(db_session, "BOUGHT ON AMAZON")
        assert len(matches) == 0

    def test_exact_match(self, db_session):
        cat = self._make_category(db_session)
        self._make_rule(db_session, "NETFLIX.COM", "exact", cat)
        matches = apply_rules(db_session, "NETFLIX.COM")
        assert len(matches) == 1

    def test_exact_no_match(self, db_session):
        cat = self._make_category(db_session)
        self._make_rule(db_session, "NETFLIX.COM", "exact", cat)
        matches = apply_rules(db_session, "NETFLIX.COM/UK")
        assert len(matches) == 0

    def test_case_insensitive(self, db_session):
        """All match types are case-insensitive."""
        cat = self._make_category(db_session)
        self._make_rule(db_session, "tesco", "contains", cat)
        matches = apply_rules(db_session, "TESCO STORES")
        assert len(matches) == 1

    def test_case_insensitive_description(self, db_session):
        """Lower-case description matches upper-case rule."""
        cat = self._make_category(db_session)
        self._make_rule(db_session, "TESCO", "contains", cat)
        matches = apply_rules(db_session, "tesco stores")
        assert len(matches) == 1

    def test_conflict_detection(self, db_session):
        """Multiple matching rules return all matches (conflict)."""
        cat1 = self._make_category(db_session, "Cat1")
        cat2 = self._make_category(db_session, "Cat2")
        self._make_rule(db_session, "TESCO", "contains", cat1)
        self._make_rule(db_session, "TESCO STORES", "contains", cat2)
        matches = apply_rules(db_session, "TESCO STORES 6224")
        assert len(matches) == 2

    def test_no_rules(self, db_session):
        """No rules in DB returns empty list."""
        matches = apply_rules(db_session, "ANY DESCRIPTION")
        assert matches == []
