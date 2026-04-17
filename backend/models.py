"""SQLAlchemy ORM models for Budget app."""
from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, Date, DateTime,
    ForeignKey, LargeBinary, Index
)
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(80), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bank_name = Column(String(100), nullable=False)
    account_name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    bank_profile = relationship("BankProfile", back_populates="account", uselist=False, cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")
    uploaded_files = relationship("UploadedFile", back_populates="account", cascade="all, delete-orphan")


class BankProfile(Base):
    __tablename__ = "bank_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, unique=True)
    date_column = Column(Integer, nullable=False)
    description_column = Column(Integer, nullable=False)
    amount_column = Column(Integer, nullable=True)
    debit_column = Column(Integer, nullable=True)
    credit_column = Column(Integer, nullable=True)
    balance_column = Column(Integer, nullable=True)
    date_format = Column(String(30), nullable=False, default="DD/MM/YYYY")
    has_header = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    account = relationship("Account", back_populates="bank_profile")


class CategoryGroup(Base):
    __tablename__ = "category_groups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)

    categories = relationship("Category", back_populates="group", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_id = Column(Integer, ForeignKey("category_groups.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    default_tier = Column(String(20), nullable=True)  # Essential, Optional, Discretionary, Savings, Transfer
    created_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("CategoryGroup", back_populates="categories")
    transactions = relationship("Transaction", back_populates="category")
    rules = relationship("Rule", back_populates="category")


class Rule(Base):
    __tablename__ = "rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    match_pattern = Column(String(255), nullable=False)
    match_type = Column(String(20), nullable=False, default="contains")  # contains, starts_with, exact
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    default_tier = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    category = relationship("Category", back_populates="rules")


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        Index("idx_transactions_date", "date"),
        Index("idx_transactions_account", "account_id"),
        Index("idx_transactions_category", "category_id"),
        Index("idx_transactions_flow_type", "flow_type"),
        Index("idx_transactions_tier", "tier"),
        Index("idx_transactions_parent", "parent_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey("transactions.id", ondelete="CASCADE"), nullable=True)
    date = Column(Date, nullable=False)
    description = Column(Text, nullable=False)
    amount = Column(Float, nullable=False)  # positive = in, negative = out
    balance = Column(Float, nullable=True)
    direction = Column(String(5), nullable=False)  # 'in' or 'out'
    flow_type = Column(String(20), nullable=True)  # income, spending, transfer
    income_type = Column(String(20), nullable=True)  # salary, bonus, rsu, investments
    tier = Column(String(20), nullable=True)  # Essential, Optional, Discretionary, Savings, Transfer
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    item = Column(Text, nullable=True)
    is_split = Column(Boolean, default=False)
    rule_id = Column(Integer, ForeignKey("rules.id", ondelete="SET NULL"), nullable=True)
    source_file_id = Column(Integer, ForeignKey("uploaded_files.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    account = relationship("Account", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")
    rule = relationship("Rule")
    source_file = relationship("UploadedFile", back_populates="transactions")
    parent = relationship("Transaction", remote_side=[id], backref="children")


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    encrypted_data = Column(LargeBinary, nullable=False)
    import_date = Column(DateTime, default=datetime.utcnow)
    transaction_count = Column(Integer, default=0)

    account = relationship("Account", back_populates="uploaded_files")
    transactions = relationship("Transaction", back_populates="source_file")
