"""Shared test fixtures for Budget backend tests."""
import os
import pytest
from datetime import date, datetime
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

# Force test database location BEFORE any app imports
os.environ["BUDGET_DATA_DIR"] = "/tmp/budget_test_data"
os.environ["BUDGET_SECRET_KEY"] = "test-secret-key-not-for-production"
os.environ["BUDGET_ENCRYPTION_KEY"] = "VGVzdEtleUZvckVuY3J5cHRpb24xMjM0NTY3ODkwMTI="  # base64 fernet key

from budget.backend.database import Base, get_db
from budget.backend.main import app
from budget.backend.models import (
    User, Account, BankProfile, CategoryGroup, Category,
    Rule, Transaction, UploadedFile,
)
from budget.backend.auth import hash_password, create_access_token
from budget.backend.seed import seed_categories


@pytest.fixture(scope="function")
def db_engine():
    """Create a fresh in-memory SQLite database for each test."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(db_engine):
    """Provide a transactional database session."""
    Session = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = Session()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture(scope="function")
def client(db_session):
    """FastAPI test client with overridden DB dependency."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db_session):
    """Create a test user and return it."""
    user = User(
        username="testuser",
        password_hash=hash_password("testpass123"),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user):
    """Return Authorization headers for the test user."""
    token = create_access_token(data={"sub": test_user.username})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def seeded_db(db_session):
    """Seed default categories into the database."""
    seed_categories(db_session)
    return db_session


@pytest.fixture
def sample_account(db_session, test_user):
    """Create a sample bank account."""
    account = Account(bank_name="Co-Op", account_name="Main")
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    return account


@pytest.fixture
def sample_category_group(db_session):
    """Create a sample category group."""
    group = CategoryGroup(name="Test Group")
    db_session.add(group)
    db_session.commit()
    db_session.refresh(group)
    return group


@pytest.fixture
def sample_category(db_session, sample_category_group):
    """Create a sample category."""
    cat = Category(
        group_id=sample_category_group.id,
        name="Groceries",
        default_tier="Essential",
    )
    db_session.add(cat)
    db_session.commit()
    db_session.refresh(cat)
    return cat


@pytest.fixture
def sample_rule(db_session, sample_category):
    """Create a sample auto-categorisation rule."""
    rule = Rule(
        match_pattern="TESCO",
        match_type="contains",
        category_id=sample_category.id,
        default_tier="Essential",
    )
    db_session.add(rule)
    db_session.commit()
    db_session.refresh(rule)
    return rule


@pytest.fixture
def sample_transaction(db_session, sample_account, sample_category):
    """Create a sample outgoing transaction."""
    tx = Transaction(
        account_id=sample_account.id,
        date=date(2025, 3, 15),
        description="TESCO STORES 6224",
        amount=-45.50,
        balance=1200.00,
        direction="out",
        flow_type="spending",
        tier="Essential",
        category_id=sample_category.id,
    )
    db_session.add(tx)
    db_session.commit()
    db_session.refresh(tx)
    return tx


@pytest.fixture
def sample_income_transaction(db_session, sample_account):
    """Create a sample income transaction."""
    tx = Transaction(
        account_id=sample_account.id,
        date=date(2025, 3, 1),
        description="EMPLOYER LTD SALARY",
        amount=5000.00,
        balance=6200.00,
        direction="in",
        flow_type="income",
        income_type="salary",
    )
    db_session.add(tx)
    db_session.commit()
    db_session.refresh(tx)
    return tx


@pytest.fixture
def sample_savings_transaction(db_session, sample_account):
    """Create a sample savings transaction (neutral tier)."""
    tx = Transaction(
        account_id=sample_account.id,
        date=date(2025, 3, 5),
        description="TRANSFER TO SAVINGS",
        amount=-500.00,
        balance=5700.00,
        direction="out",
        flow_type="spending",
        tier="Savings",
    )
    db_session.add(tx)
    db_session.commit()
    db_session.refresh(tx)
    return tx


@pytest.fixture
def sample_transfer_transaction(db_session, sample_account):
    """Create a sample transfer transaction (neutral tier)."""
    tx = Transaction(
        account_id=sample_account.id,
        date=date(2025, 3, 5),
        description="TRANSFER TO MONZO",
        amount=-200.00,
        balance=5500.00,
        direction="out",
        flow_type="transfer",
        tier="Transfer",
    )
    db_session.add(tx)
    db_session.commit()
    db_session.refresh(tx)
    return tx


def make_csv_content(rows, header=True):
    """Helper: build CSV string from a list of rows."""
    import io, csv
    output = io.StringIO()
    writer = csv.writer(output)
    if header:
        writer.writerow(["Date", "Description", "Amount", "Balance"])
    for row in rows:
        writer.writerow(row)
    return output.getvalue().encode("utf-8")
