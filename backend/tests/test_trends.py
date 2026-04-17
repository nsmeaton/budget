"""Tests for trends endpoint — category trends, tier breakdown, income vs spending."""
import pytest
from datetime import date
from budget.backend.models import Transaction, Account, Category, CategoryGroup


def _create_account(db):
    acct = Account(bank_name="TestBank", account_name="Current")
    db.add(acct)
    db.flush()
    return acct


def _create_category(db, name="Cat", tier="Essential"):
    grp = CategoryGroup(name=f"TG-{name}")
    db.add(grp)
    db.flush()
    cat = Category(group_id=grp.id, name=name, default_tier=tier)
    db.add(cat)
    db.flush()
    return cat


def _add_tx(db, acct, dt, desc, amount, direction, flow_type,
            tier=None, income_type=None, category_id=None, is_split=False, parent_id=None):
    tx = Transaction(
        account_id=acct.id, date=dt, description=desc, amount=amount,
        direction=direction, flow_type=flow_type, tier=tier,
        income_type=income_type, category_id=category_id,
        is_split=is_split, parent_id=parent_id,
    )
    db.add(tx)
    db.flush()
    return tx


class TestEmptyTrends:
    def test_empty(self, client, auth_headers):
        resp = client.get("/api/trends?date_from=2025-01-01&date_to=2025-12-31",
                          headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["category_trends"] == []
        assert data["top_categories"] == []
        assert data["income_vs_spending"] == []


class TestCategoryTrends:
    @pytest.fixture(autouse=True)
    def _setup(self, db_session, test_user):
        self.acct = _create_account(db_session)
        self.cat1 = _create_category(db_session, "Groceries", "Essential")
        self.cat2 = _create_category(db_session, "Eating Out", "Discretionary")

        # Jan
        _add_tx(db_session, self.acct, date(2025, 1, 5), "TESCO", -200,
                "out", "spending", tier="Essential", category_id=self.cat1.id)
        _add_tx(db_session, self.acct, date(2025, 1, 10), "WAGAMAMA", -60,
                "out", "spending", tier="Discretionary", category_id=self.cat2.id)
        # Feb
        _add_tx(db_session, self.acct, date(2025, 2, 5), "ALDI", -180,
                "out", "spending", tier="Essential", category_id=self.cat1.id)
        _add_tx(db_session, self.acct, date(2025, 2, 12), "NANDO'S", -45,
                "out", "spending", tier="Discretionary", category_id=self.cat2.id)
        db_session.commit()

    def test_category_trends_returned(self, client, auth_headers):
        resp = client.get("/api/trends?date_from=2025-01-01&date_to=2025-02-28",
                          headers=auth_headers)
        data = resp.json()
        cat_names = [c["category_name"] for c in data["category_trends"]]
        assert "Groceries" in cat_names
        assert "Eating Out" in cat_names

    def test_category_trend_data_by_month(self, client, auth_headers):
        resp = client.get("/api/trends?date_from=2025-01-01&date_to=2025-02-28",
                          headers=auth_headers)
        trends = {t["category_name"]: t for t in resp.json()["category_trends"]}
        groceries = trends["Groceries"]
        # Should have data points for Jan and Feb
        months = {d["month"] for d in groceries["data"]}
        assert "2025-01" in months
        assert "2025-02" in months

    def test_top_categories_ordered(self, client, auth_headers):
        """Top categories are sorted by total spend descending."""
        resp = client.get("/api/trends?date_from=2025-01-01&date_to=2025-02-28",
                          headers=auth_headers)
        top = resp.json()["top_categories"]
        assert len(top) >= 2
        assert top[0]["total"] >= top[1]["total"]

    def test_top_categories_percentages(self, client, auth_headers):
        """Top categories include valid percentage values."""
        resp = client.get("/api/trends?date_from=2025-01-01&date_to=2025-02-28",
                          headers=auth_headers)
        top = resp.json()["top_categories"]
        total_pct = sum(c["percentage"] for c in top)
        assert 99.0 <= total_pct <= 101.0  # Rounding tolerance


class TestTierBreakdown:
    @pytest.fixture(autouse=True)
    def _setup(self, db_session, test_user):
        self.acct = _create_account(db_session)

        _add_tx(db_session, self.acct, date(2025, 1, 5), "ESSENTIAL", -300,
                "out", "spending", tier="Essential")
        _add_tx(db_session, self.acct, date(2025, 1, 10), "OPTIONAL", -100,
                "out", "spending", tier="Optional")
        _add_tx(db_session, self.acct, date(2025, 1, 15), "DISCRETIONARY", -50,
                "out", "spending", tier="Discretionary")
        db_session.commit()

    def test_tier_trends_all_three(self, client, auth_headers):
        resp = client.get("/api/trends?date_from=2025-01-01&date_to=2025-01-31",
                          headers=auth_headers)
        tiers = {t["tier"]: t for t in resp.json()["tier_trends"]}
        assert "Essential" in tiers
        assert "Optional" in tiers
        assert "Discretionary" in tiers

    def test_tier_amounts_correct(self, client, auth_headers):
        resp = client.get("/api/trends?date_from=2025-01-01&date_to=2025-01-31",
                          headers=auth_headers)
        tiers = {t["tier"]: t for t in resp.json()["tier_trends"]}
        jan_essential = next(d for d in tiers["Essential"]["data"] if d["month"] == "2025-01")
        assert jan_essential["amount"] == 300


class TestIncomeVsSpending:
    @pytest.fixture(autouse=True)
    def _setup(self, db_session, test_user):
        self.acct = _create_account(db_session)

        _add_tx(db_session, self.acct, date(2025, 1, 1), "SALARY", 5000,
                "in", "income", income_type="salary")
        _add_tx(db_session, self.acct, date(2025, 1, 10), "SHOPPING", -800,
                "out", "spending", tier="Essential")
        _add_tx(db_session, self.acct, date(2025, 1, 20), "SAVINGS", -500,
                "out", "spending", tier="Savings")
        db_session.commit()

    def test_income_vs_spending_month(self, client, auth_headers):
        resp = client.get("/api/trends?date_from=2025-01-01&date_to=2025-01-31",
                          headers=auth_headers)
        ivs = resp.json()["income_vs_spending"]
        assert len(ivs) == 1
        jan = ivs[0]
        assert jan["month"] == "2025-01"
        assert jan["income"] == 5000
        assert jan["spending"] == 800  # excludes savings
        assert jan["savings"] == 500


class TestSavingsTransferExclusion:
    """Savings and Transfer tiers should not appear in spending metrics."""

    @pytest.fixture(autouse=True)
    def _setup(self, db_session, test_user):
        self.acct = _create_account(db_session)
        cat_savings = _create_category(db_session, "Savings", "Savings")
        cat_transfer = _create_category(db_session, "Transfer", "Transfer")
        cat_food = _create_category(db_session, "Food", "Essential")

        _add_tx(db_session, self.acct, date(2025, 1, 5), "TO ISA", -500,
                "out", "spending", tier="Savings", category_id=cat_savings.id)
        _add_tx(db_session, self.acct, date(2025, 1, 10), "TO MONZO", -200,
                "out", "transfer", tier="Transfer", category_id=cat_transfer.id)
        _add_tx(db_session, self.acct, date(2025, 1, 15), "TESCO", -100,
                "out", "spending", tier="Essential", category_id=cat_food.id)
        db_session.commit()

    def test_savings_excluded_from_category_trends(self, client, auth_headers):
        resp = client.get("/api/trends?date_from=2025-01-01&date_to=2025-01-31",
                          headers=auth_headers)
        cat_names = [c["category_name"] for c in resp.json()["category_trends"]]
        assert "Savings" not in cat_names
        assert "Transfer" not in cat_names
        assert "Food" in cat_names

    def test_savings_excluded_from_top_categories(self, client, auth_headers):
        resp = client.get("/api/trends?date_from=2025-01-01&date_to=2025-01-31",
                          headers=auth_headers)
        top_names = [c["category_name"] for c in resp.json()["top_categories"]]
        assert "Savings" not in top_names
        assert "Transfer" not in top_names

    def test_savings_excluded_from_tier_trends(self, client, auth_headers):
        """Tier trends only include Essential, Optional, Discretionary."""
        resp = client.get("/api/trends?date_from=2025-01-01&date_to=2025-01-31",
                          headers=auth_headers)
        tier_names = [t["tier"] for t in resp.json()["tier_trends"]]
        assert "Savings" not in tier_names
        assert "Transfer" not in tier_names


class TestTrendsDateFilter:
    def test_respects_date_range(self, client, auth_headers, db_session, test_user):
        acct = _create_account(db_session)
        cat = _create_category(db_session, "Food2", "Essential")

        _add_tx(db_session, acct, date(2025, 1, 10), "JAN FOOD", -100,
                "out", "spending", tier="Essential", category_id=cat.id)
        _add_tx(db_session, acct, date(2025, 6, 10), "JUN FOOD", -200,
                "out", "spending", tier="Essential", category_id=cat.id)
        db_session.commit()

        resp = client.get("/api/trends?date_from=2025-01-01&date_to=2025-03-31",
                          headers=auth_headers)
        top = resp.json()["top_categories"]
        if top:
            assert top[0]["total"] == 100  # only Jan included
