"""Trends router — category trends, tier breakdown, top categories."""
from datetime import date, datetime
from typing import Optional
from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Transaction, Category, User
from ..schemas import TrendsResponse, CategoryTrend, TierTrend, TopCategory
from ..auth import get_current_user

router = APIRouter(prefix="/api/trends", tags=["trends"])


@router.get("", response_model=TrendsResponse)
def get_trends(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not date_from:
        date_from = date(datetime.now().year, 1, 1)
    if not date_to:
        date_to = date(datetime.now().year, 12, 31)

    # Get all visible transactions
    txs = db.query(Transaction).filter(
        Transaction.date >= date_from,
        Transaction.date <= date_to,
        Transaction.is_split == False,
        Transaction.parent_id.is_(None),
    ).all()
    split_children = db.query(Transaction).filter(
        Transaction.date >= date_from,
        Transaction.date <= date_to,
        Transaction.parent_id.isnot(None),
    ).all()
    all_txs = txs + split_children

    # Category trends (top 5 spending categories by month)
    cat_month: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    cat_totals: dict[str, float] = defaultdict(float)

    for tx in all_txs:
        if tx.direction != "out" or tx.tier in ("Savings", "Transfer"):
            continue
        cat_name = tx.category.name if tx.category else "Uncategorised"
        month_key = tx.date.strftime("%Y-%m")
        cat_month[cat_name][month_key] += abs(tx.amount)
        cat_totals[cat_name] += abs(tx.amount)

    # Top 5 categories
    top_5 = sorted(cat_totals.items(), key=lambda x: x[1], reverse=True)[:5]
    total_spending = sum(cat_totals.values())

    category_trends = []
    for cat_name, _ in top_5:
        data = [{"month": m, "amount": round(cat_month[cat_name].get(m, 0), 2)}
                for m in sorted(set(m for d in cat_month.values() for m in d.keys()))]
        category_trends.append(CategoryTrend(category_name=cat_name, data=data))

    # Tier breakdown over time
    tier_month: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for tx in all_txs:
        if tx.direction != "out" or tx.tier in ("Savings", "Transfer", None):
            continue
        month_key = tx.date.strftime("%Y-%m")
        tier_month[tx.tier][month_key] += abs(tx.amount)

    all_months = sorted(set(m for d in tier_month.values() for m in d.keys()))
    tier_trends = []
    for tier in ["Essential", "Optional", "Discretionary"]:
        data = [{"month": m, "amount": round(tier_month[tier].get(m, 0), 2)} for m in all_months]
        tier_trends.append(TierTrend(tier=tier, data=data))

    # Income vs spending
    income_month: dict[str, float] = defaultdict(float)
    spending_month: dict[str, float] = defaultdict(float)
    savings_month: dict[str, float] = defaultdict(float)
    for tx in all_txs:
        month_key = tx.date.strftime("%Y-%m")
        if tx.direction == "in":
            income_month[month_key] += tx.amount
        elif tx.tier == "Savings":
            savings_month[month_key] += abs(tx.amount)
        elif tx.tier != "Transfer" and tx.direction == "out":
            spending_month[month_key] += abs(tx.amount)

    all_m = sorted(set(list(income_month.keys()) + list(spending_month.keys())))
    income_vs_spending = [
        {"month": m, "income": round(income_month.get(m, 0), 2),
         "spending": round(spending_month.get(m, 0), 2),
         "savings": round(savings_month.get(m, 0), 2)}
        for m in all_m
    ]

    # Top categories
    top_categories = []
    for cat_name, total in sorted(cat_totals.items(), key=lambda x: x[1], reverse=True)[:10]:
        pct = (total / total_spending * 100) if total_spending > 0 else 0
        top_categories.append(TopCategory(
            category_name=cat_name, total=round(total, 2), percentage=round(pct, 1)
        ))

    return TrendsResponse(
        category_trends=category_trends,
        tier_trends=tier_trends,
        income_vs_spending=income_vs_spending,
        top_categories=top_categories,
    )
