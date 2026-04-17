"""Tests for dashboard KPIs and monthly breakdown."""
import pytest
from datetime import date
from budget.backend.models import Transaction, Account, Category, CategoryGroup


def _create_account(db):
    acct = Account(bank_name="TestBank", account_name="Current")
    db.add(acct)
    db.flush()
    return acct


def _create_category(db, name="Cat", tier="Essential"):
    grp = CategoryGroup(name=f"DG-{name}")
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


class TestEmptyDashboard:
    def test_empty(self, client, auth_headers):
        """Dashboard with no transactions returns zero KPIs."""
        resp = client.get("/api/dashboard?date_from=2025-01-01&date_to=2025-12-31",
                          headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["kpis"]["total_income"] == 0
        assert data["kpis"]["total_spending"] == 0
        assert data["kpis"]["total_savings"] == 0
        assert data["kpis"]["savings_rate"] == 0
        assert data["monthly_breakdown"] == []


class TestDashboardKPIs:
    @pytest.fixture(autouse=True)
    def _setup(self, db_session, test_user):
        self.acct = _create_account(db_session)
        cat = _create_category(db_session, "Groceries", "Essential")
        cat2 = _create_category(db_session, "Eating Out", "Discretionary")

        # January income
        _add_tx(db_session, self.acct, date(2025, 1, 1), "SALARY", 5000,
                "in", "income", income_type="salary")
        _add_tx(db_session, self.acct, date(2025, 1, 15), "BONUS", 2000,
                "in", "income", income_type="bonus")

        # January spending
        _add_tx(db_session, self.acct, date(2025, 1, 5), "TESCO", -300,
                "out", "spending", tier="Essential", category_id=cat.id)
        _add_tx(db_session, self.acct, date(2025, 1, 10), "WAGAMAMA", -60,
                "out", "spending", tier="Discretionary", category_id=cat2.id)

        # January savings (neutral tier)
        _add_tx(db_session, self.acct, date(2025, 1, 20), "TRANSFER TO ISA", -500,
                "out", "spending", tier="Savings")

        # January transfer (neutral tier)
        _add_tx(db_session, self.acct, date(2025, 1, 22), "TO MONZO", -200,
                "out", "transfer", tier="Transfer")

        # February income
        _add_tx(db_session, self.acct, date(2025, 2, 1), "SALARY", 5000,
                "in", "income", income_type="salary")

        # February spending
        _add_tx(db_session, self.acct, date(2025, 2, 5), "TESCO", -280,
                "out", "spending", tier="Essential", category_id=cat.id)

        db_session.commit()
        self.cat = cat

    def test_total_income(self, client, auth_headers):
        resp = client.get("/api/dashboard?date_from=2025-01-01&date_to=2025-02-28",
                          headers=auth_headers)
        kpis = resp.json()["kpis"]
        # 5000 + 2000 + 5000 = 12000
        assert kpis["total_income"] == 12000

    def test_total_spending_excludes_savings_and_transfers(self, client, auth_headers):
        """Spending total should NOT include Savings or Transfer tiers."""
        resp = client.get("/api/dashboard?date_from=2025-01-01&date_to=2025-02-28",
                          headers=auth_headers)
        kpis = resp.json()["kpis"]
        # 300 + 60 + 280 = 640 (excludes 500 savings + 200 transfer)
        assert kpis["total_spending"] == 640

    def test_total_savings(self, client, auth_headers):
        resp = client.get("/api/dashboard?date_from=2025-01-01&date_to=2025-02-28",
                          headers=auth_headers)
        kpis = resp.json()["kpis"]
        assert kpis["total_savings"] == 500

    def test_savings_rate(self, client, auth_headers):
        """Savings rate = (total_savings / total_income) × 100."""
        resp = client.get("/api/dashboard?date_from=2025-01-01&date_to=2025-02-28",
                          headers=auth_headers)
        kpis = resp.json()["kpis"]
        expected = round(500 / 12000 * 100, 1)
        assert kpis["savings_rate"] == expected

    def test_avg_monthly_essential(self, client, auth_headers):
        """Average monthly essential spending across months with essential spend."""
        resp = client.get("/api/dashboard?date_from=2025-01-01&date_to=2025-02-28",
                          headers=auth_headers)
        kpis = resp.json()["kpis"]
        # Jan: 300, Feb: 280 → avg = 290
        assert kpis["avg_monthly_essential"] == 290.0


class TestMonthlyBreakdown:
    @pytest.fixture(autouse=True)
    def _setup(self, db_session, test_user):
        self.acct = _create_account(db_session)

        _add_tx(db_session, self.acct, date(2025, 1, 1), "SALARY", 5000,
                "in", "income", income_type="salary")
        _add_tx(db_session, self.acct, date(2025, 1, 10), "RSU VEST", 1500,
                "in", "income", income_type="rsu")
        _add_tx(db_session, self.acct, date(2025, 1, 5), "GROCERIES", -400,
                "out", "spending", tier="Essential")
        _add_tx(db_session, self.acct, date(2025, 1, 8), "CINEMA", -25,
                "out", "spending", tier="Discretionary")
        _add_tx(db_session, self.acct, date(2025, 1, 15), "CLOTHES", -100,
                "out", "spending", tier="Optional")
        _add_tx(db_session, self.acct, date(2025, 1, 20), "ISA", -300,
                "out", "spending", tier="Savings")
        _add_tx(db_session, self.acct, date(2025, 1, 25), "TO MONZO", -150,
                "out", "transfer", tier="Transfer")
        db_session.commit()

    def test_monthly_income_by_type(self, client, auth_headers):
        resp = client.get("/api/dashboard?date_from=2025-01-01&date_to=2025-01-31",
                          headers=auth_headers)
        months = resp.json()["monthly_breakdown"]
        assert len(months) == 1
        m = months[0]
        assert m["month"] == "2025-01"
        assert m["income_salary"] == 5000
        assert m["income_rsu"] == 1500
        assert m["income_total"] == 6500

    def test_monthly_spending_by_tier(self, client, auth_headers):
        resp = client.get("/api/dashboard?date_from=2025-01-01&date_to=2025-01-31",
                          headers=auth_headers)
        m = resp.json()["monthly_breakdown"][0]
        assert m["spending_essential"] == 400
        assert m["spending_discretionary"] == 25
        assert m["spending_optional"] == 100
        assert m["spending_total"] == 525  # 400+25+100, not including savings/transfer

    def test_monthly_savings_and_transfers(self, client, auth_headers):
        resp = client.get("/api/dashboard?date_from=2025-01-01&date_to=2025-01-31",
                          headers=auth_headers)
        m = resp.json()["monthly_breakdown"][0]
        assert m["savings"] == 300
        assert m["transfers"] == 150


class TestDashboardDateFilter:
    def test_filters_by_date_range(self, client, auth_headers, db_session, test_user):
        acct = _create_account(db_session)
        _add_tx(db_session, acct, date(2025, 1, 15), "JAN TX", -100, "out", "spending", tier="Essential")
        _add_tx(db_session, acct, date(2025, 3, 15), "MAR TX", -200, "out", "spending", tier="Essential")
        db_session.commit()

        # Only January
        resp = client.get("/api/dashboard?date_from=2025-01-01&date_to=2025-01-31",
                          headers=auth_headers)
        kpis = resp.json()["kpis"]
        assert kpis["total_spending"] == 100

        # Full range
        resp2 = client.get("/api/dashboard?date_from=2025-01-01&date_to=2025-12-31",
                           headers=auth_headers)
        kpis2 = resp2.json()["kpis"]
        assert kpis2["total_spending"] == 300


class TestDashboardSplitTransactions:
    def test_split_children_counted_not_parent(self, client, auth_headers, db_session, test_user):
        """Split children contribute to dashboard; parent does not."""
        acct = _create_account(db_session)
        cat = _create_category(db_session, "Food", "Essential")

        parent = _add_tx(db_session, acct, date(2025, 1, 10), "TESCO", -100,
                         "out", "spending", tier="Essential", is_split=True)
        _add_tx(db_session, acct, date(2025, 1, 10), "Food", -60,
                "out", "spending", tier="Essential", parent_id=parent.id, category_id=cat.id)
        _add_tx(db_session, acct, date(2025, 1, 10), "Cleaning", -40,
                "out", "spending", tier="Optional", parent_id=parent.id)
        db_session.commit()

        resp = client.get("/api/dashboard?date_from=2025-01-01&date_to=2025-01-31",
                          headers=auth_headers)
        kpis = resp.json()["kpis"]
        # Children: 60 essential + 40 optional = 100 spending
        assert kpis["total_spending"] == 100
