"""Tests for accounts CRUD endpoints."""
import pytest


class TestListAccounts:
    def test_empty_list(self, client, auth_headers):
        """No accounts returns empty list."""
        resp = client.get("/api/accounts", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_with_accounts(self, client, auth_headers, sample_account):
        """Lists all accounts."""
        resp = client.get("/api/accounts", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["bank_name"] == "Co-Op"
        assert data[0]["account_name"] == "Main"
        assert data[0]["transaction_count"] == 0

    def test_list_includes_transaction_count(self, client, auth_headers, sample_transaction):
        """Account listing includes transaction count."""
        resp = client.get("/api/accounts", headers=auth_headers)
        data = resp.json()
        assert len(data) == 1
        assert data[0]["transaction_count"] == 1

    def test_list_includes_current_balance(self, client, auth_headers, sample_transaction):
        """Account listing shows latest balance."""
        resp = client.get("/api/accounts", headers=auth_headers)
        data = resp.json()
        assert data[0]["current_balance"] == 1200.00


class TestCreateAccount:
    def test_create(self, client, auth_headers):
        """Create a new account."""
        resp = client.post("/api/accounts", json={
            "bank_name": "Monzo",
            "account_name": "Personal",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["bank_name"] == "Monzo"
        assert data["account_name"] == "Personal"
        assert "id" in data
        assert data["transaction_count"] == 0

    def test_create_multiple(self, client, auth_headers):
        """Can create multiple accounts."""
        client.post("/api/accounts", json={"bank_name": "Monzo", "account_name": "A"}, headers=auth_headers)
        client.post("/api/accounts", json={"bank_name": "Starling", "account_name": "B"}, headers=auth_headers)
        resp = client.get("/api/accounts", headers=auth_headers)
        assert len(resp.json()) == 2


class TestUpdateAccount:
    def test_update_bank_name(self, client, auth_headers, sample_account):
        """Update account bank name."""
        resp = client.put(f"/api/accounts/{sample_account.id}", json={
            "bank_name": "Starling",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["bank_name"] == "Starling"
        assert resp.json()["account_name"] == "Main"  # unchanged

    def test_update_account_name(self, client, auth_headers, sample_account):
        """Update account name."""
        resp = client.put(f"/api/accounts/{sample_account.id}", json={
            "account_name": "Joint",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["account_name"] == "Joint"

    def test_update_nonexistent(self, client, auth_headers):
        """Updating a missing account returns 404."""
        resp = client.put("/api/accounts/9999", json={
            "bank_name": "Ghost Bank",
        }, headers=auth_headers)
        assert resp.status_code == 404


class TestDeleteAccount:
    def test_delete(self, client, auth_headers, sample_account):
        """Delete an account."""
        resp = client.delete(f"/api/accounts/{sample_account.id}", headers=auth_headers)
        assert resp.status_code == 200

        # Verify it's gone
        resp = client.get("/api/accounts", headers=auth_headers)
        assert resp.json() == []

    def test_delete_nonexistent(self, client, auth_headers):
        """Deleting a missing account returns 404."""
        resp = client.delete("/api/accounts/9999", headers=auth_headers)
        assert resp.status_code == 404

    def test_delete_cascades_transactions(self, client, auth_headers, sample_transaction, db_session):
        """Deleting an account also removes its transactions."""
        from budget.backend.models import Transaction
        acct_id = sample_transaction.account_id
        resp = client.delete(f"/api/accounts/{acct_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert db_session.query(Transaction).filter(Transaction.account_id == acct_id).count() == 0


class TestAccountAuth:
    def test_list_requires_auth(self, client):
        resp = client.get("/api/accounts")
        assert resp.status_code == 401

    def test_create_requires_auth(self, client):
        resp = client.post("/api/accounts", json={"bank_name": "X", "account_name": "Y"})
        assert resp.status_code == 401
