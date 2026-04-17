"""Dashboard router — KPIs and monthly breakdown."""
from datetime import date, datetime
from typing import Optional
from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract

from ..database import get_db
from ..models import Transaction, User
from ..schemas import DashboardResponse, DashboardKPIs, MonthlyBreakdown
from ..auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
def get_dashboard(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get dashboard KPIs and monthly breakdown for the given date range."""
    # Default to current year
    if not date_from:
        date_from = date(datetime.now().year, 1, 1)
    if not date_to:
        date_to = date(datetime.now().year, 12, 31)

    # Get all visible transactions in range
    txs = db.query(Transaction).filter(
        Transaction.date >= date_from,
        Transaction.date <= date_to,
        Transaction.is_split == False,
        # Include split children
    ).all()

    # Also get split children
    split_children = db.query(Transaction).filter(
        Transaction.date >= date_from,
        Transaction.date <= date_to,
        Transaction.parent_id.isnot(None),
    ).all()

    # Combine: non-split normal txs + split children
    all_txs = [t for t in txs if t.parent_id is None] + split_children

    # Build monthly breakdown
    months: dict[str, MonthlyBreakdown] = {}

    for tx in all_txs:
        month_key = tx.date.strftime("%Y-%m")
        if month_key not in months:
            months[month_key] = MonthlyBreakdown(month=month_key)

        mb = months[month_key]

        if tx.flow_type == "income" or tx.direction == "in":
            income_type = (tx.income_type or "").lower()
            if income_type == "salary":
                mb.income_salary += tx.amount
            elif income_type == "bonus":
                mb.income_bonus += tx.amount
            elif income_type == "rsu":
                mb.income_rsu += tx.amount
            elif income_type == "investments":
                mb.income_investments += tx.amount
            else:
                mb.income_salary += tx.amount  # Default uncategorised income to salary
            mb.income_total += tx.amount

        elif tx.tier == "Savings":
            mb.savings += abs(tx.amount)

        elif tx.tier == "Transfer":
            mb.transfers += abs(tx.amount)

        elif tx.direction == "out":
            tier = tx.tier or ""
            if tier == "Essential":
                mb.spending_essential += abs(tx.amount)
            elif tier == "Optional":
                mb.spending_optional += abs(tx.amount)
            elif tier == "Discretionary":
                mb.spending_discretionary += abs(tx.amount)
            else:
                # Uncategorised outgoing — count as spending
                mb.spending_discretionary += abs(tx.amount)
            mb.spending_total += abs(tx.amount)

    # Calculate net for each month
    for mb in months.values():
        mb.net = mb.income_total - mb.spending_total - mb.savings

    # Sort by month
    sorted_months = sorted(months.values(), key=lambda m: m.month)

    # Calculate KPIs
    total_income = sum(m.income_total for m in sorted_months)
    total_spending = sum(m.spending_total for m in sorted_months)
    total_savings = sum(m.savings for m in sorted_months)

    essential_months = [m.spending_essential for m in sorted_months if m.spending_essential > 0]
    avg_essential = sum(essential_months) / len(essential_months) if essential_months else 0.0

    savings_rate = (total_savings / total_income * 100) if total_income > 0 else 0.0

    kpis = DashboardKPIs(
        total_income=total_income,
        total_spending=total_spending,
        avg_monthly_essential=round(avg_essential, 2),
        total_savings=total_savings,
        savings_rate=round(savings_rate, 1),
    )

    return DashboardResponse(
        kpis=kpis,
        monthly_breakdown=sorted_months,
        date_from=date_from,
        date_to=date_to,
    )
