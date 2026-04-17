"""Tests for transactions CRUD, filtering, splitting, and bulk operations."""
import pytest
from datetime import date
from budget.backend.models import Transaction, Account, Category, CategoryGroup


# ── Helpers ───────────────────────────────────────────

def _create_account(db):
    acct = Account(bank_name="TestBank", account_name="Current")
    db.add(acct)
    db.flush()
    return acct


def _create_category(db, name="TestCat", tier="Essential"):
    grp = CategoryGroup(name=f"Grp-{name}")
    db.add(grp)
    db.flush()
    cat = Category(group_id=grp.id, name=name, default_tier=tier)
    db.add(cat)
    db.flush()
    return cat


def _create_tx(db, acct, **kwargs):
    defaults = dict(
        account_id=acct.id,
        date=date(2025, 3, 15),
        description="TESCO STORES",
        amount=-25.00,
        direction="out",
        flow_type="spending",
        tier="Essential",
    )
    defaults.update(kwargs)
    tx = Transaction(**defaults)
    db.add(tx)
    db.flush()
    return tx


# ── Listing / Read ────────────────────────────────────

class TestListTransactions:
    def test_empty(self, client, auth_headers):
        resp = client.get("/api/transactions", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0

    def test_list_single(self, client, auth_headers, sample_transaction):
        resp = client.get("/api/transactions", headers=auth_headers)
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["description"] == "TESCO STORES 6224"

    def test_get_by_id(self, client, auth_headers, sample_transaction):
        resp = client.get(f"/api/transactions/{sample_transaction.id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == sample_transaction.id

    def test_get_nonexistent(self, client, auth_headers):
        resp = client.get("/api/transactions/99999", headers=auth_headers)
        assert resp.status_code == 404


# ── Filtering ─────────────────────────────────────────

class TestFiltering:
    @pytest.fixture(autouse=True)
    def _setup_data(self, db_session, test_user):
        self.acct1 = _create_account(db_session)
        acct2 = Account(bank_name="OtherBank", account_name="Savings")
        db_session.add(acct2)
        db_session.flush()
        self.acct2 = acct2

        cat = _create_category(db_session, "Groceries", "Essential")
        cat2 = _create_category(db_session, "Eating Out", "Discretionary")
        self.cat = cat
        self.cat2 = cat2

        _create_tx(db_session, self.acct1, description="TESCO", category_id=cat.id, tier="Essential",
                    date=date(2025, 1, 10), amount=-30)
        _create_tx(db_session, self.acct1, description="WAGAMAMA", category_id=cat2.id, tier="Discretionary",
                    date=date(2025, 2, 5), amount=-50)
        _create_tx(db_session, self.acct2, description="ALDI", category_id=cat.id, tier="Essential",
                    date=date(2025, 3, 1), amount=-20)
        _create_tx(db_session, self.acct1, description="EMPLOYER LTD", direction="in", flow_type="income",
                    tier=None, date=date(2025, 1, 1), amount=3000)
        db_session.commit()

    def test_filter_by_account(self, client, auth_headers):
        resp = client.get(f"/api/transactions?account_id={self.acct1.id}", headers=auth_headers)
        items = resp.json()["items"]
        assert all(i["account_id"] == self.acct1.id for i in items)
        assert len(items) == 3

    def test_filter_by_category(self, client, auth_headers):
        resp = client.get(f"/api/transactions?category_id={self.cat.id}", headers=auth_headers)
        items = resp.json()["items"]
        assert all(i["category_id"] == self.cat.id for i in items)
        assert len(items) == 2

    def test_filter_by_tier(self, client, auth_headers):
        resp = client.get("/api/transactions?tier=Discretionary", headers=auth_headers)
        items = resp.json()["items"]
        assert len(items) == 1
        assert items[0]["description"] == "WAGAMAMA"

    def test_filter_by_flow_type(self, client, auth_headers):
        resp = client.get("/api/transactions?flow_type=income", headers=auth_headers)
        items = resp.json()["items"]
        assert len(items) == 1
        assert items[0]["amount"] == 3000

    def test_filter_by_date_range(self, client, auth_headers):
        resp = client.get("/api/transactions?date_from=2025-02-01&date_to=2025-02-28", headers=auth_headers)
        items = resp.json()["items"]
        assert len(items) == 1
        assert items[0]["description"] == "WAGAMAMA"

    def test_search_description(self, client, auth_headers):
        resp = client.get("/api/transactions?search=TESCO", headers=auth_headers)
        items = resp.json()["items"]
        assert len(items) == 1
        assert "TESCO" in items[0]["description"]

    def test_search_case_insensitive(self, client, auth_headers):
        resp = client.get("/api/transactions?search=tesco", headers=auth_headers)
        items = resp.json()["items"]
        assert len(items) == 1

    def test_filter_by_direction(self, client, auth_headers):
        resp = client.get("/api/transactions?direction=in", headers=auth_headers)
        items = resp.json()["items"]
        assert len(items) == 1


# ── Pagination ────────────────────────────────────────

class TestPagination:
    def test_pagination(self, client, auth_headers, db_session, test_user):
        acct = _create_account(db_session)
        for i in range(15):
            _create_tx(db_session, acct, description=f"TX-{i:03d}",
                       date=date(2025, 1, i + 1))
        db_session.commit()

        resp = client.get("/api/transactions?page=1&page_size=10", headers=auth_headers)
        data = resp.json()
        assert data["total"] == 15
        assert data["page"] == 1
        assert data["page_size"] == 10
        assert len(data["items"]) == 10

        resp2 = client.get("/api/transactions?page=2&page_size=10", headers=auth_headers)
        data2 = resp2.json()
        assert len(data2["items"]) == 5

    def test_default_page_size(self, client, auth_headers, db_session, test_user):
        acct = _create_account(db_session)
        for i in range(3):
            _create_tx(db_session, acct, description=f"TX-{i}")
        db_session.commit()

        resp = client.get("/api/transactions", headers=auth_headers)
        data = resp.json()
        assert data["page"] == 1
        assert data["page_size"] == 50  # default


# ── Update / Delete ───────────────────────────────────

class TestUpdateTransaction:
    def test_update_category(self, client, auth_headers, sample_transaction, sample_category):
        resp = client.put(f"/api/transactions/{sample_transaction.id}", json={
            "tier": "Discretionary",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["tier"] == "Discretionary"

    def test_update_item(self, client, auth_headers, sample_transaction):
        resp = client.put(f"/api/transactions/{sample_transaction.id}", json={
            "item": "Weekly shop",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["item"] == "Weekly shop"

    def test_update_nonexistent(self, client, auth_headers):
        resp = client.put("/api/transactions/99999", json={"item": "X"}, headers=auth_headers)
        assert resp.status_code == 404


class TestDeleteTransaction:
    def test_delete(self, client, auth_headers, sample_transaction):
        resp = client.delete(f"/api/transactions/{sample_transaction.id}", headers=auth_headers)
        assert resp.status_code == 200

        resp = client.get(f"/api/transactions/{sample_transaction.id}", headers=auth_headers)
        assert resp.status_code == 404

    def test_delete_nonexistent(self, client, auth_headers):
        resp = client.delete("/api/transactions/99999", headers=auth_headers)
        assert resp.status_code == 404


# ── Splitting ─────────────────────────────────────────

class TestSplitTransaction:
    def test_split_success(self, client, auth_headers, sample_transaction):
        """Split a -45.50 transaction into two children."""
        children = [
            {"amount": -30.00, "description": "Food", "tier": "Essential"},
            {"amount": -15.50, "description": "Cleaning", "tier": "Optional"},
        ]
        resp = client.post(
            f"/api/transactions/{sample_transaction.id}/split",
            json=children, headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_split"] is True
        assert len(data["children"]) == 2
        child_amounts = sorted([c["amount"] for c in data["children"]])
        assert child_amounts == [-30.00, -15.50]

    def test_split_invalid_sum(self, client, auth_headers, sample_transaction):
        """Children that don't sum to parent amount are rejected."""
        children = [
            {"amount": -20.00},
            {"amount": -10.00},
        ]
        resp = client.post(
            f"/api/transactions/{sample_transaction.id}/split",
            json=children, headers=auth_headers,
        )
        assert resp.status_code == 400
        assert "sum" in resp.json()["detail"].lower()

    def test_split_already_split(self, client, auth_headers, sample_transaction):
        """Cannot split a transaction that's already split."""
        children = [
            {"amount": -30.00},
            {"amount": -15.50},
        ]
        client.post(f"/api/transactions/{sample_transaction.id}/split",
                     json=children, headers=auth_headers)

        resp = client.post(f"/api/transactions/{sample_transaction.id}/split",
                           json=children, headers=auth_headers)
        assert resp.status_code == 400
        assert "already split" in resp.json()["detail"].lower()

    def test_split_child_transaction(self, client, auth_headers, db_session, sample_transaction):
        """Cannot split a child transaction."""
        children = [
            {"amount": -30.00},
            {"amount": -15.50},
        ]
        resp = client.post(f"/api/transactions/{sample_transaction.id}/split",
                           json=children, headers=auth_headers)
        child_id = resp.json()["children"][0]["id"]

        resp2 = client.post(f"/api/transactions/{child_id}/split",
                            json=[{"amount": -15.00}, {"amount": -15.00}],
                            headers=auth_headers)
        assert resp2.status_code == 400
        assert "child" in resp2.json()["detail"].lower()

    def test_split_nonexistent(self, client, auth_headers):
        resp = client.post("/api/transactions/99999/split",
                           json=[{"amount": -10}], headers=auth_headers)
        assert resp.status_code == 404


class TestDeleteSplitChild:
    def test_delete_last_child_unsplits_parent(self, client, auth_headers, db_session, sample_transaction):
        """When all children are deleted, parent reverts to non-split."""
        # Split into one child (edge case)
        children = [{"amount": -45.50}]
        resp = client.post(f"/api/transactions/{sample_transaction.id}/split",
                           json=children, headers=auth_headers)
        child_id = resp.json()["children"][0]["id"]

        # Delete the only child
        client.delete(f"/api/transactions/{child_id}", headers=auth_headers)

        # Parent should be un-split
        resp2 = client.get(f"/api/transactions/{sample_transaction.id}", headers=auth_headers)
        assert resp2.json()["is_split"] is False

    def test_delete_one_of_multiple_children(self, client, auth_headers, sample_transaction):
        """Deleting one child leaves parent as split if siblings remain."""
        children = [
            {"amount": -30.00},
            {"amount": -15.50},
        ]
        resp = client.post(f"/api/transactions/{sample_transaction.id}/split",
                           json=children, headers=auth_headers)
        child_ids = [c["id"] for c in resp.json()["children"]]

        # Delete one child
        client.delete(f"/api/transactions/{child_ids[0]}", headers=auth_headers)

        # Parent still split (one sibling remains)
        resp2 = client.get(f"/api/transactions/{sample_transaction.id}", headers=auth_headers)
        assert resp2.json()["is_split"] is True


# ── Bulk Categorise ───────────────────────────────────

class TestBulkCategorise:
    def test_bulk_categorise(self, client, auth_headers, db_session, test_user):
        acct = _create_account(db_session)
        cat = _create_category(db_session, "Food", "Essential")
        tx1 = _create_tx(db_session, acct, description="TX1", category_id=None, tier=None)
        tx2 = _create_tx(db_session, acct, description="TX2", category_id=None, tier=None)
        db_session.commit()

        resp = client.post("/api/transactions/bulk/categorise", json={
            "transaction_ids": [tx1.id, tx2.id],
            "category_id": cat.id,
            "tier": "Essential",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["updated"] == 2

        # Verify
        r1 = client.get(f"/api/transactions/{tx1.id}", headers=auth_headers)
        assert r1.json()["category_id"] == cat.id
        assert r1.json()["tier"] == "Essential"

    def test_bulk_categorise_uses_default_tier(self, client, auth_headers, db_session, test_user):
        """If no tier specified, uses category's default_tier."""
        acct = _create_account(db_session)
        cat = _create_category(db_session, "Takeaway", "Discretionary")
        tx = _create_tx(db_session, acct, description="TX1", category_id=None, tier=None)
        db_session.commit()

        resp = client.post("/api/transactions/bulk/categorise", json={
            "transaction_ids": [tx.id],
            "category_id": cat.id,
        }, headers=auth_headers)
        assert resp.status_code == 200

        r = client.get(f"/api/transactions/{tx.id}", headers=auth_headers)
        assert r.json()["tier"] == "Discretionary"

    def test_bulk_categorise_invalid_category(self, client, auth_headers, db_session, test_user):
        acct = _create_account(db_session)
        tx = _create_tx(db_session, acct)
        db_session.commit()

        resp = client.post("/api/transactions/bulk/categorise", json={
            "transaction_ids": [tx.id],
            "category_id": 9999,
        }, headers=auth_headers)
        assert resp.status_code == 404
