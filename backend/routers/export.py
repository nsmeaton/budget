"""Export router — full data export for backup."""
import json
import io
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Account, BankProfile, CategoryGroup, Category,
    Rule, Transaction, User
)
from ..auth import get_current_user

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/full")
def export_full(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Export all data as JSON for backup."""
    data = {
        "exported_at": datetime.utcnow().isoformat(),
        "version": "1.0",
        "accounts": [],
        "category_groups": [],
        "categories": [],
        "rules": [],
        "transactions": [],
    }

    for a in db.query(Account).all():
        acct = {"id": a.id, "bank_name": a.bank_name, "account_name": a.account_name}
        if a.bank_profile:
            bp = a.bank_profile
            acct["bank_profile"] = {
                "date_column": bp.date_column,
                "description_column": bp.description_column,
                "amount_column": bp.amount_column,
                "debit_column": bp.debit_column,
                "credit_column": bp.credit_column,
                "balance_column": bp.balance_column,
                "date_format": bp.date_format,
                "has_header": bp.has_header,
            }
        data["accounts"].append(acct)

    for g in db.query(CategoryGroup).all():
        data["category_groups"].append({"id": g.id, "name": g.name})

    for c in db.query(Category).all():
        data["categories"].append({
            "id": c.id, "group_id": c.group_id,
            "name": c.name, "default_tier": c.default_tier,
        })

    for r in db.query(Rule).all():
        data["rules"].append({
            "id": r.id, "match_pattern": r.match_pattern,
            "match_type": r.match_type, "category_id": r.category_id,
            "default_tier": r.default_tier,
        })

    for t in db.query(Transaction).all():
        data["transactions"].append({
            "id": t.id, "account_id": t.account_id,
            "parent_id": t.parent_id, "date": str(t.date),
            "description": t.description, "amount": t.amount,
            "balance": t.balance, "direction": t.direction,
            "flow_type": t.flow_type, "income_type": t.income_type,
            "tier": t.tier, "category_id": t.category_id,
            "item": t.item, "is_split": t.is_split,
        })

    content = json.dumps(data, indent=2)
    filename = f"budget_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

    return StreamingResponse(
        io.BytesIO(content.encode()),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
