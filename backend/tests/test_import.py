"""Tests for CSV import — preview, process, duplicates, auto-categorisation."""
import json
import pytest
from datetime import date

from budget.backend.models import (
    Transaction, Account, Category, CategoryGroup, Rule, BankProfile,
)
from budget.backend.routers.import_csv import _import_sessions
from budget.backend.tests.conftest import make_csv_content


# ── Helpers ───────────────────────────────────────────

def _setup_session(csv_bytes, session_id="test-session", filename="test.csv"):
    """Inject CSV data into the import session cache for testing."""
    _import_sessions[session_id] = {
        "content": csv_bytes.decode("utf-8"),
        "filename": filename,
        "raw_bytes": csv_bytes,
    }
    return session_id


def _make_account(db):
    acct = Account(bank_name="TestBank", account_name="Current")
    db.add(acct)
    db.flush()
    return acct


def _make_category(db, name="Groceries", tier="Essential"):
    grp = CategoryGroup(name=f"G-{name}")
    db.add(grp)
    db.flush()
    cat = Category(group_id=grp.id, name=name, default_tier=tier)
    db.add(cat)
    db.flush()
    return cat


def _make_rule(db, pattern, match_type, category, tier=None):
    rule = Rule(
        match_pattern=pattern, match_type=match_type,
        category_id=category.id, default_tier=tier or category.default_tier,
    )
    db.add(rule)
    db.flush()
    return rule


def _base_mapping(account_id):
    return {
        "account_id": account_id,
        "date_column": 0,
        "description_column": 1,
        "amount_column": 2,
        "balance_column": 3,
        "date_format": "DD/MM/YYYY",
        "has_header": True,
        "save_profile": False,
    }


# ── Preview ───────────────────────────────────────────

class TestPreview:
    def test_preview_csv(self, client, auth_headers):
        csv = make_csv_content([
            ["01/01/2025", "TESCO STORES", "-25.00", "1200.00"],
            ["02/01/2025", "ALDI", "-15.00", "1185.00"],
            ["03/01/2025", "NETFLIX", "-9.99", "1175.01"],
        ])
        resp = client.post(
            "/api/import/preview",
            files={"file": ("bank.csv", csv, "text/csv")},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["headers"] == ["Date", "Description", "Amount", "Balance"]
        assert data["total_rows"] == 3
        assert len(data["rows"]) == 3

    def test_preview_first_five_rows(self, client, auth_headers):
        """Preview returns at most 5 data rows."""
        rows = [[f"0{i}/01/2025", f"TX-{i}", f"-{i}.00", "100.00"] for i in range(1, 9)]
        csv = make_csv_content(rows)
        resp = client.post(
            "/api/import/preview",
            files={"file": ("big.csv", csv, "text/csv")},
            headers=auth_headers,
        )
        data = resp.json()
        assert data["total_rows"] == 8
        assert len(data["rows"]) == 5

    def test_preview_empty_csv(self, client, auth_headers):
        """Empty CSV returns 400."""
        resp = client.post(
            "/api/import/preview",
            files={"file": ("empty.csv", b"", "text/csv")},
            headers=auth_headers,
        )
        assert resp.status_code == 400


# ── Process Import ────────────────────────────────────

class TestProcessImport:
    def test_basic_import(self, client, auth_headers, db_session, test_user):
        """Import a CSV and verify transactions are created."""
        acct = _make_account(db_session)
        db_session.commit()

        csv = make_csv_content([
            ["15/03/2025", "TESCO STORES", "-45.50", "1200.00"],
            ["16/03/2025", "ALDI SUPERMARKET", "-22.30", "1177.70"],
        ])
        sid = _setup_session(csv)
        mapping = _base_mapping(acct.id)

        resp = client.post(
            f"/api/import/process?session_id={sid}",
            json=mapping, headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["imported"] == 2
        assert data["total_rows"] == 2

        # Verify DB
        txs = db_session.query(Transaction).filter(Transaction.account_id == acct.id).all()
        assert len(txs) == 2

    def test_import_sets_direction(self, client, auth_headers, db_session, test_user):
        """Positive amounts → 'in', negative → 'out'."""
        acct = _make_account(db_session)
        db_session.commit()

        csv = make_csv_content([
            ["01/03/2025", "SALARY", "3000.00", "4200.00"],
            ["02/03/2025", "RENT", "-1200.00", "3000.00"],
        ])
        sid = _setup_session(csv)

        resp = client.post(
            f"/api/import/process?session_id={sid}",
            json=_base_mapping(acct.id), headers=auth_headers,
        )
        data = resp.json()
        assert data["imported"] == 2

        txs = db_session.query(Transaction).filter(Transaction.account_id == acct.id).order_by(Transaction.amount).all()
        assert txs[0].direction == "out"
        assert txs[1].direction == "in"

    def test_import_nonexistent_account(self, client, auth_headers, db_session, test_user):
        csv = make_csv_content([["01/01/2025", "X", "-10", "100"]])
        sid = _setup_session(csv)
        mapping = _base_mapping(9999)
        resp = client.post(f"/api/import/process?session_id={sid}", json=mapping, headers=auth_headers)
        assert resp.status_code == 404

    def test_import_no_csv_data(self, client, auth_headers, db_session, test_user):
        """No file and no valid session_id returns 400."""
        acct = _make_account(db_session)
        db_session.commit()
        mapping = _base_mapping(acct.id)
        resp = client.post("/api/import/process?session_id=nope", json=mapping, headers=auth_headers)
        assert resp.status_code == 400


# ── Duplicate Detection ──────────────────────────────

class TestDuplicateDetection:
    def test_duplicates_detected(self, client, auth_headers, db_session, test_user):
        """Importing the same data twice flags duplicates."""
        acct = _make_account(db_session)
        db_session.commit()

        csv = make_csv_content([["15/03/2025", "TESCO", "-25.00", "1200.00"]])

        # First import
        sid1 = _setup_session(csv, session_id="s1")
        resp1 = client.post(f"/api/import/process?session_id=s1",
                            json=_base_mapping(acct.id), headers=auth_headers)
        assert resp1.json()["imported"] == 1
        assert resp1.json()["duplicates_flagged"] == 0

        # Second import — same data
        sid2 = _setup_session(csv, session_id="s2")
        resp2 = client.post(f"/api/import/process?session_id=s2",
                            json=_base_mapping(acct.id), headers=auth_headers)
        assert resp2.json()["imported"] == 0
        assert resp2.json()["duplicates_flagged"] == 1
        dupes = resp2.json()["duplicate_candidates"]
        assert len(dupes) == 1
        assert dupes[0]["description"] == "TESCO"

    def test_different_amount_not_duplicate(self, client, auth_headers, db_session, test_user):
        """Same date/description but different amount is not a duplicate."""
        acct = _make_account(db_session)
        db_session.commit()

        csv1 = make_csv_content([["15/03/2025", "TESCO", "-25.00", "1200.00"]])
        csv2 = make_csv_content([["15/03/2025", "TESCO", "-30.00", "1170.00"]])

        _setup_session(csv1, session_id="s1")
        client.post(f"/api/import/process?session_id=s1",
                     json=_base_mapping(acct.id), headers=auth_headers)

        _setup_session(csv2, session_id="s2")
        resp = client.post(f"/api/import/process?session_id=s2",
                           json=_base_mapping(acct.id), headers=auth_headers)
        assert resp.json()["duplicates_flagged"] == 0
        assert resp.json()["imported"] == 1


# ── Auto-Categorisation ──────────────────────────────

class TestAutoCategorisation:
    def test_single_rule_match(self, client, auth_headers, db_session, test_user):
        """Transaction matching exactly one rule gets auto-categorised."""
        acct = _make_account(db_session)
        cat = _make_category(db_session, "Groceries", "Essential")
        _make_rule(db_session, "TESCO", "contains", cat, "Essential")
        db_session.commit()

        csv = make_csv_content([["15/03/2025", "TESCO STORES 6224", "-45.50", "1200.00"]])
        _setup_session(csv)

        resp = client.post(f"/api/import/process?session_id=test-session",
                           json=_base_mapping(acct.id), headers=auth_headers)
        data = resp.json()
        assert data["auto_categorised"] == 1
        assert data["needs_review"] == 0

        tx = db_session.query(Transaction).filter(Transaction.account_id == acct.id).first()
        assert tx.category_id == cat.id
        assert tx.tier == "Essential"

    def test_conflicting_rules(self, client, auth_headers, db_session, test_user):
        """Multiple matching rules leave the transaction uncategorised."""
        acct = _make_account(db_session)
        cat1 = _make_category(db_session, "Groceries", "Essential")
        cat2 = _make_category(db_session, "Shopping", "Optional")
        _make_rule(db_session, "TESCO", "contains", cat1)
        _make_rule(db_session, "TESCO STORES", "contains", cat2)
        db_session.commit()

        csv = make_csv_content([["15/03/2025", "TESCO STORES 6224", "-45.50", "1200.00"]])
        _setup_session(csv)

        resp = client.post(f"/api/import/process?session_id=test-session",
                           json=_base_mapping(acct.id), headers=auth_headers)
        data = resp.json()
        assert data["auto_categorised"] == 0
        assert data["needs_review"] == 1

        tx = db_session.query(Transaction).filter(Transaction.account_id == acct.id).first()
        assert tx.category_id is None

    def test_no_matching_rules(self, client, auth_headers, db_session, test_user):
        """Transaction with no matching rules is flagged for review."""
        acct = _make_account(db_session)
        db_session.commit()

        csv = make_csv_content([["15/03/2025", "RANDOM SHOP", "-10.00", "1190.00"]])
        _setup_session(csv)

        resp = client.post(f"/api/import/process?session_id=test-session",
                           json=_base_mapping(acct.id), headers=auth_headers)
        data = resp.json()
        assert data["needs_review"] == 1
        assert len(data["uncategorised_ids"]) == 1


# ── Bank Profile ──────────────────────────────────────

class TestBankProfileSave:
    def test_profile_saved_on_import(self, client, auth_headers, db_session, test_user):
        """Import with save_profile=True creates a BankProfile."""
        acct = _make_account(db_session)
        db_session.commit()

        csv = make_csv_content([["15/03/2025", "TESCO", "-25.00", "1200.00"]])
        _setup_session(csv)

        mapping = _base_mapping(acct.id)
        mapping["save_profile"] = True

        resp = client.post(f"/api/import/process?session_id=test-session",
                           json=mapping, headers=auth_headers)
        assert resp.status_code == 200

        profile = db_session.query(BankProfile).filter(BankProfile.account_id == acct.id).first()
        assert profile is not None
        assert profile.date_column == 0
        assert profile.description_column == 1
        assert profile.amount_column == 2
        assert profile.date_format == "DD/MM/YYYY"

    def test_profile_updated_on_reimport(self, client, auth_headers, db_session, test_user):
        """Re-importing with save_profile updates existing profile."""
        acct = _make_account(db_session)
        db_session.commit()

        csv = make_csv_content([["15/03/2025", "TX", "-10", "100"]])

        # First import
        _setup_session(csv, session_id="s1")
        mapping = _base_mapping(acct.id)
        mapping["save_profile"] = True
        client.post(f"/api/import/process?session_id=s1", json=mapping, headers=auth_headers)

        # Second import with different date format
        csv2 = make_csv_content([["2025-04-01", "TX2", "-20", "80"]], header=True)
        _setup_session(csv2, session_id="s2")
        mapping2 = _base_mapping(acct.id)
        mapping2["save_profile"] = True
        mapping2["date_format"] = "YYYY-MM-DD"
        client.post(f"/api/import/process?session_id=s2", json=mapping2, headers=auth_headers)

        profile = db_session.query(BankProfile).filter(BankProfile.account_id == acct.id).first()
        assert profile.date_format == "YYYY-MM-DD"


# ── Date Formats ──────────────────────────────────────

class TestDateFormats:
    def test_iso_format(self, client, auth_headers, db_session, test_user):
        acct = _make_account(db_session)
        db_session.commit()

        csv = make_csv_content([["2025-03-15", "TESCO", "-25.00", "1200.00"]])
        _setup_session(csv)
        mapping = _base_mapping(acct.id)
        mapping["date_format"] = "YYYY-MM-DD"

        resp = client.post(f"/api/import/process?session_id=test-session",
                           json=mapping, headers=auth_headers)
        assert resp.json()["imported"] == 1

        tx = db_session.query(Transaction).filter(Transaction.account_id == acct.id).first()
        assert tx.date == date(2025, 3, 15)

    def test_us_format(self, client, auth_headers, db_session, test_user):
        acct = _make_account(db_session)
        db_session.commit()

        csv = make_csv_content([["03/15/2025", "TESCO", "-25.00", "1200.00"]])
        _setup_session(csv)
        mapping = _base_mapping(acct.id)
        mapping["date_format"] = "MM/DD/YYYY"

        resp = client.post(f"/api/import/process?session_id=test-session",
                           json=mapping, headers=auth_headers)
        assert resp.json()["imported"] == 1

    def test_short_year_format(self, client, auth_headers, db_session, test_user):
        acct = _make_account(db_session)
        db_session.commit()

        csv = make_csv_content([["15/03/25", "TESCO", "-25.00", "1200.00"]])
        _setup_session(csv)
        mapping = _base_mapping(acct.id)
        mapping["date_format"] = "DD/MM/YY"

        resp = client.post(f"/api/import/process?session_id=test-session",
                           json=mapping, headers=auth_headers)
        assert resp.json()["imported"] == 1


# ── Debit / Credit Columns ───────────────────────────

class TestDebitCreditColumns:
    def test_separate_debit_credit(self, client, auth_headers, db_session, test_user):
        """Import with separate debit and credit columns."""
        acct = _make_account(db_session)
        db_session.commit()

        # CSV: Date, Description, Debit, Credit, Balance
        import io, csv
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Date", "Description", "Debit", "Credit", "Balance"])
        writer.writerow(["15/03/2025", "TESCO", "45.50", "", "1154.50"])
        writer.writerow(["01/03/2025", "SALARY", "", "3000.00", "4200.00"])
        csv_bytes = output.getvalue().encode("utf-8")

        _setup_session(csv_bytes)
        mapping = {
            "account_id": acct.id,
            "date_column": 0,
            "description_column": 1,
            "debit_column": 2,
            "credit_column": 3,
            "balance_column": 4,
            "date_format": "DD/MM/YYYY",
            "has_header": True,
            "save_profile": False,
        }

        resp = client.post(f"/api/import/process?session_id=test-session",
                           json=mapping, headers=auth_headers)
        data = resp.json()
        assert data["imported"] == 2

        txs = db_session.query(Transaction).filter(
            Transaction.account_id == acct.id
        ).order_by(Transaction.amount).all()
        assert txs[0].amount < 0  # debit
        assert txs[0].direction == "out"
        assert txs[1].amount > 0  # credit
        assert txs[1].direction == "in"


# ── Malformed / Edge Cases ────────────────────────────

class TestEdgeCases:
    def test_skip_empty_rows(self, client, auth_headers, db_session, test_user):
        """Empty rows in CSV are skipped."""
        acct = _make_account(db_session)
        db_session.commit()

        import io, csv
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Date", "Description", "Amount", "Balance"])
        writer.writerow(["15/03/2025", "TESCO", "-25.00", "1200.00"])
        writer.writerow(["", "", "", ""])
        writer.writerow(["16/03/2025", "ALDI", "-10.00", "1190.00"])
        csv_bytes = output.getvalue().encode("utf-8")

        _setup_session(csv_bytes)
        resp = client.post(f"/api/import/process?session_id=test-session",
                           json=_base_mapping(acct.id), headers=auth_headers)
        assert resp.json()["imported"] == 2

    def test_skip_bad_date(self, client, auth_headers, db_session, test_user):
        """Rows with unparseable dates are skipped."""
        acct = _make_account(db_session)
        db_session.commit()

        csv = make_csv_content([
            ["not-a-date", "TESCO", "-25.00", "1200.00"],
            ["15/03/2025", "ALDI", "-10.00", "1190.00"],
        ])
        _setup_session(csv)
        resp = client.post(f"/api/import/process?session_id=test-session",
                           json=_base_mapping(acct.id), headers=auth_headers)
        assert resp.json()["imported"] == 1

    def test_handles_currency_symbols(self, client, auth_headers, db_session, test_user):
        """Amounts with £ signs and commas are parsed correctly."""
        acct = _make_account(db_session)
        db_session.commit()

        csv = make_csv_content([
            ["15/03/2025", "BIG PURCHASE", "-£1,250.00", "£3,750.00"],
        ])
        _setup_session(csv)
        resp = client.post(f"/api/import/process?session_id=test-session",
                           json=_base_mapping(acct.id), headers=auth_headers)
        assert resp.json()["imported"] == 1

        tx = db_session.query(Transaction).filter(Transaction.account_id == acct.id).first()
        assert tx.amount == -1250.00
        assert tx.balance == 3750.00
