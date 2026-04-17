"""Pydantic schemas for request/response validation."""
from __future__ import annotations
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ── Auth ──────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    username: str

class SetupRequest(BaseModel):
    username: str = Field(min_length=3)
    password: str = Field(min_length=8)


# ── Accounts ──────────────────────────────────────────
class AccountCreate(BaseModel):
    bank_name: str
    account_name: str

class AccountUpdate(BaseModel):
    bank_name: Optional[str] = None
    account_name: Optional[str] = None

class BankProfileSchema(BaseModel):
    id: int
    account_id: int
    date_column: int
    description_column: int
    amount_column: Optional[int] = None
    debit_column: Optional[int] = None
    credit_column: Optional[int] = None
    balance_column: Optional[int] = None
    date_format: str
    has_header: bool = True
    class Config:
        from_attributes = True

class AccountResponse(BaseModel):
    id: int
    bank_name: str
    account_name: str
    created_at: datetime
    bank_profile: Optional[BankProfileSchema] = None
    transaction_count: int = 0
    last_import_date: Optional[datetime] = None
    current_balance: Optional[float] = None
    class Config:
        from_attributes = True


# ── Bank Profiles ─────────────────────────────────────
class BankProfileCreate(BaseModel):
    account_id: int
    date_column: int
    description_column: int
    amount_column: Optional[int] = None
    debit_column: Optional[int] = None
    credit_column: Optional[int] = None
    balance_column: Optional[int] = None
    date_format: str = "DD/MM/YYYY"
    has_header: bool = True

class BankProfileUpdate(BaseModel):
    date_column: Optional[int] = None
    description_column: Optional[int] = None
    amount_column: Optional[int] = None
    debit_column: Optional[int] = None
    credit_column: Optional[int] = None
    balance_column: Optional[int] = None
    date_format: Optional[str] = None
    has_header: Optional[bool] = None


# ── Category Groups ───────────────────────────────────
class CategoryGroupCreate(BaseModel):
    name: str

class CategoryGroupResponse(BaseModel):
    id: int
    name: str
    categories: List[CategoryResponse] = []
    transaction_count: int = 0
    total_spend: float = 0.0
    class Config:
        from_attributes = True


# ── Categories ────────────────────────────────────────
class CategoryCreate(BaseModel):
    group_id: int
    name: str
    default_tier: Optional[str] = None

class CategoryUpdate(BaseModel):
    group_id: Optional[int] = None
    name: Optional[str] = None
    default_tier: Optional[str] = None

class CategoryResponse(BaseModel):
    id: int
    group_id: int
    group_name: str = ""
    name: str
    default_tier: Optional[str] = None
    transaction_count: int = 0
    total_spend: float = 0.0
    created_at: datetime
    class Config:
        from_attributes = True


# ── Rules ─────────────────────────────────────────────
class RuleCreate(BaseModel):
    match_pattern: str
    match_type: str = "contains"
    category_id: int
    default_tier: Optional[str] = None

class RuleUpdate(BaseModel):
    match_pattern: Optional[str] = None
    match_type: Optional[str] = None
    category_id: Optional[int] = None
    default_tier: Optional[str] = None

class RuleResponse(BaseModel):
    id: int
    match_pattern: str
    match_type: str
    category_id: int
    category_name: str = ""
    default_tier: Optional[str] = None
    matched_count: int = 0
    created_at: datetime
    class Config:
        from_attributes = True


# ── Transactions ──────────────────────────────────────
class TransactionCreate(BaseModel):
    account_id: int
    date: date
    description: str
    amount: float
    balance: Optional[float] = None
    direction: str  # 'in' or 'out'
    flow_type: Optional[str] = None
    income_type: Optional[str] = None
    tier: Optional[str] = None
    category_id: Optional[int] = None
    item: Optional[str] = None

class TransactionUpdate(BaseModel):
    date: Optional[date] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    direction: Optional[str] = None
    flow_type: Optional[str] = None
    income_type: Optional[str] = None
    tier: Optional[str] = None
    category_id: Optional[int] = None
    item: Optional[str] = None

class TransactionResponse(BaseModel):
    id: int
    account_id: int
    account_name: str = ""
    bank_name: str = ""
    parent_id: Optional[int] = None
    date: date
    description: str
    amount: float
    balance: Optional[float] = None
    direction: str
    flow_type: Optional[str] = None
    income_type: Optional[str] = None
    tier: Optional[str] = None
    category_id: Optional[int] = None
    category_name: str = ""
    item: Optional[str] = None
    is_split: bool = False
    rule_id: Optional[int] = None
    children: List[TransactionResponse] = []
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class TransactionSplitRequest(BaseModel):
    """Split a transaction into multiple children."""
    children: List[TransactionSplitChild]

class TransactionSplitChild(BaseModel):
    amount: float
    description: Optional[str] = None
    flow_type: Optional[str] = None
    income_type: Optional[str] = None
    tier: Optional[str] = None
    category_id: Optional[int] = None
    item: Optional[str] = None

class BulkCategoriseRequest(BaseModel):
    transaction_ids: List[int]
    category_id: int
    tier: Optional[str] = None

class TransactionListResponse(BaseModel):
    items: List[TransactionResponse]
    total: int
    page: int
    page_size: int


# ── Import ────────────────────────────────────────────
class CSVPreviewResponse(BaseModel):
    headers: List[str]
    rows: List[List[str]]
    total_rows: int

class ImportMappingRequest(BaseModel):
    account_id: int
    date_column: int
    description_column: int
    amount_column: Optional[int] = None
    debit_column: Optional[int] = None
    credit_column: Optional[int] = None
    balance_column: Optional[int] = None
    date_format: str = "DD/MM/YYYY"
    has_header: bool = True
    save_profile: bool = True

class DuplicateCandidate(BaseModel):
    csv_row: int
    date: str
    description: str
    amount: float
    existing_id: int
    existing_date: str
    existing_description: str
    existing_amount: float

class ImportResult(BaseModel):
    total_rows: int
    imported: int
    auto_categorised: int
    needs_review: int
    duplicates_flagged: int
    duplicate_candidates: List[DuplicateCandidate] = []
    uncategorised_ids: List[int] = []

class ImportConfirmRequest(BaseModel):
    """Confirm which duplicates to skip."""
    skip_row_indices: List[int] = []


# ── Dashboard ─────────────────────────────────────────
class MonthlyBreakdown(BaseModel):
    month: str  # "2025-01"
    income_salary: float = 0.0
    income_bonus: float = 0.0
    income_rsu: float = 0.0
    income_investments: float = 0.0
    income_total: float = 0.0
    spending_essential: float = 0.0
    spending_optional: float = 0.0
    spending_discretionary: float = 0.0
    spending_total: float = 0.0
    savings: float = 0.0
    transfers: float = 0.0
    net: float = 0.0

class DashboardKPIs(BaseModel):
    total_income: float
    total_spending: float
    avg_monthly_essential: float
    total_savings: float
    savings_rate: float  # percentage
    income_change_pct: Optional[float] = None

class DashboardResponse(BaseModel):
    kpis: DashboardKPIs
    monthly_breakdown: List[MonthlyBreakdown]
    date_from: date
    date_to: date


# ── Trends ────────────────────────────────────────────
class CategoryTrend(BaseModel):
    category_name: str
    data: List[dict]  # [{month: "2025-01", amount: 123.45}, ...]

class TierTrend(BaseModel):
    tier: str
    data: List[dict]

class TopCategory(BaseModel):
    category_name: str
    total: float
    percentage: float

class TrendsResponse(BaseModel):
    category_trends: List[CategoryTrend]
    tier_trends: List[TierTrend]
    income_vs_spending: List[dict]
    top_categories: List[TopCategory]


# ── Export ────────────────────────────────────────────
class ExportResponse(BaseModel):
    filename: str
    size_bytes: int


# Fix forward references
TransactionSplitRequest.model_rebuild()
CategoryGroupResponse.model_rebuild()
TransactionResponse.model_rebuild()
