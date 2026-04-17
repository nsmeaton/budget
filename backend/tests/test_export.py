"""Tests for full data export endpoint."""
import json
import pytest
from budget.backend.models import (
    Account, CategoryGroup, Category, Rule, Transaction,
)
from datetime import date


class TestExportEmpty:
    def test_empty_export(self, client, auth_headers):
        """Export with no data returns valid JSON with empty arrays."""
        resp = client.get("/api/export/full", headers=auth_headers)
        assert resp.status_code == 200
        data = json.loads(resp.content)
        assert data["version"] == "1.0"
        assert "exported_at" in data
        assert data["accounts"] == []
        assert data["category_groups"] == []
        assert data["categories"] == []
        assert data["rules"] == []
        assert data["transactions"] == []


class TestExportFull:
    @pytest.fixture(autouse=True)
    def _setup(self, db_session, test_user):
        """Populate DB with all entity types."""
        self.acct = Account(bank_name="Co-Op", account_name="Main")
        db_session.add(self.acct)
        db_session.flush()

        self.group = CategoryGroup(name="Food & Drink")
        db_session.add(self.group)
        db_session.flush()

        self.cat = Category(group_id=self.group.id, name="Groceries", default_tier="Essential")
        db_session.add(self.cat)
        db_session.flush()

        self.rule = Rule(
            match_pattern="TESCO", match_type="contains",
            category_id=self.cat.id, default_tier="Essential",
        )
        db_session.add(self.rule)
        db_session.flush()

        self.tx = Transaction(
            account_id=self.acct.id, date=date(2025, 3, 15),
            description="TESCO STORES", amount=-45.50, direction="out",
            flow_type="spending", tier="Essential", category_id=self.cat.id,
        )
        db_session.add(self.tx)
        db_session.commit()

    def test_contains_all_entities(self, client, auth_headers):
        resp = client.get("/api/export/full", headers=auth_headers)
        data = json.loads(resp.content)

        assert len(data["accounts"]) == 1
        assert data["accounts"][0]["bank_name"] == "Co-Op"

        assert len(data["category_groups"]) == 1
        assert data["category_groups"][0]["name"] == "Food & Drink"

        assert len(data["categories"]) == 1
        assert data["categories"][0]["name"] == "Groceries"

        assert len(data["rules"]) == 1
        assert data["rules"][0]["match_pattern"] == "TESCO"

        assert len(data["transactions"]) == 1
        assert data["transactions"][0]["description"] == "TESCO STORES"
        assert data["transactions"][0]["amount"] == -45.50

    def test_export_streaming_response(self, client, auth_headers):
        """Export returns a streaming response with appropriate headers."""
        resp = client.get("/api/export/full", headers=auth_headers)
        assert resp.status_code == 200
        assert "application/json" in resp.headers["content-type"]
        assert "attachment" in resp.headers.get("content-disposition", "")
        assert "budget_export_" in resp.headers.get("content-disposition", "")

    def test_export_valid_json(self, client, auth_headers):
        """The response body is valid parseable JSON."""
        resp = client.get("/api/export/full", headers=auth_headers)
        data = json.loads(resp.content)  # Would raise if invalid
        assert isinstance(data, dict)
        assert "version" in data
        assert "exported_at" in data

    def test_export_transaction_fields(self, client, auth_headers):
        """Exported transactions include all expected fields."""
        resp = client.get("/api/export/full", headers=auth_headers)
        tx = json.loads(resp.content)["transactions"][0]
        expected_fields = {
            "id", "account_id", "parent_id", "date", "description",
            "amount", "balance", "direction", "flow_type", "income_type",
            "tier", "category_id", "item", "is_split",
        }
        assert expected_fields.issubset(set(tx.keys()))

    def test_export_includes_split_transactions(self, client, auth_headers, db_session):
        """Split parent and children are both exported."""
        parent = Transaction(
            account_id=self.acct.id, date=date(2025, 3, 20),
            description="MIXED PURCHASE", amount=-100, direction="out",
            flow_type="spending", is_split=True,
        )
        db_session.add(parent)
        db_session.flush()

        child = Transaction(
            account_id=self.acct.id, parent_id=parent.id,
            date=date(2025, 3, 20), description="FOOD PART",
            amount=-60, direction="out", flow_type="spending", tier="Essential",
        )
        db_session.add(child)
        db_session.commit()

        resp = client.get("/api/export/full", headers=auth_headers)
        txs = json.loads(resp.content)["transactions"]
        # Should include original tx + parent + child = 3
        assert len(txs) == 3
        parent_txs = [t for t in txs if t["is_split"]]
        child_txs = [t for t in txs if t["parent_id"] is not None]
        assert len(parent_txs) == 1
        assert len(child_txs) == 1


class TestExportAuth:
    def test_requires_auth(self, client):
        resp = client.get("/api/export/full")
        assert resp.status_code == 401
