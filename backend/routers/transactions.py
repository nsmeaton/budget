"""Transactions router — CRUD, search, split, bulk actions."""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from ..database import get_db
from ..models import Transaction, Account, Category, User
from ..schemas import (
    TransactionCreate, TransactionUpdate, TransactionResponse,
    TransactionSplitChild, BulkCategoriseRequest, TransactionListResponse,
)
from ..auth import get_current_user

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


def _tx_to_response(tx: Transaction, db: Session) -> TransactionResponse:
    children = []
    if tx.is_split:
        child_txs = db.query(Transaction).filter(Transaction.parent_id == tx.id).all()
        children = [_tx_to_response(c, db) for c in child_txs]
    return TransactionResponse(
        id=tx.id, account_id=tx.account_id,
        account_name=tx.account.account_name if tx.account else "",
        bank_name=tx.account.bank_name if tx.account else "",
        parent_id=tx.parent_id, date=tx.date, description=tx.description,
        amount=tx.amount, balance=tx.balance, direction=tx.direction,
        flow_type=tx.flow_type, income_type=tx.income_type, tier=tx.tier,
        category_id=tx.category_id,
        category_name=tx.category.name if tx.category else "",
        item=tx.item, is_split=tx.is_split, rule_id=tx.rule_id,
        children=children, created_at=tx.created_at, updated_at=tx.updated_at,
    )


@router.get("", response_model=TransactionListResponse)
def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    account_id: Optional[int] = None,
    category_id: Optional[int] = None,
    tier: Optional[str] = None,
    flow_type: Optional[str] = None,
    direction: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    search: Optional[str] = None,
    uncategorised_only: bool = False,
    sort_by: Optional[str] = Query(None, regex="^(date|description|amount|tier|category_name)$"),
    sort_dir: Optional[str] = Query("desc", regex="^(asc|desc)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Transaction).filter(
        Transaction.parent_id.is_(None),  # Hide split children in main list
        Transaction.is_split == False,     # Hide split parents too — show children instead
    )

    # Actually: show split children (they replace the parent), hide parents
    q = db.query(Transaction).filter(
        Transaction.is_split == False,  # not a split parent
    )
    # But also include children of splits
    split_parent_ids = db.query(Transaction.id).filter(Transaction.is_split == True).subquery()
    q = db.query(Transaction).filter(
        or_(
            # Normal transactions (not split parent, no parent)
            (Transaction.is_split == False) & (Transaction.parent_id.is_(None)),
            # Split children
            Transaction.parent_id.in_(db.query(Transaction.id).filter(Transaction.is_split == True))
        )
    )

    if account_id:
        q = q.filter(Transaction.account_id == account_id)
    if category_id:
        q = q.filter(Transaction.category_id == category_id)
    if tier:
        q = q.filter(Transaction.tier == tier)
    if flow_type:
        q = q.filter(Transaction.flow_type == flow_type)
    if direction:
        q = q.filter(Transaction.direction == direction)
    if date_from:
        q = q.filter(Transaction.date >= date_from)
    if date_to:
        q = q.filter(Transaction.date <= date_to)
    if search:
        search_term = f"%{search}%"
        q = q.filter(or_(
            Transaction.description.ilike(search_term),
            Transaction.item.ilike(search_term),
        ))
    if uncategorised_only:
        q = q.filter(Transaction.category_id.is_(None))

    total = q.count()

    # Dynamic sorting
    sort_column_map = {
        'date': Transaction.date,
        'description': Transaction.description,
        'amount': Transaction.amount,
        'tier': Transaction.tier,
    }
    sort_col = sort_column_map.get(sort_by or 'date', Transaction.date)
    if sort_dir == 'asc':
        q = q.order_by(sort_col.asc(), Transaction.id.asc())
    else:
        q = q.order_by(sort_col.desc(), Transaction.id.desc())

    txs = q.offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    return TransactionListResponse(
        items=[_tx_to_response(tx, db) for tx in txs],
        total=total, page=page, page_size=page_size,
    )


@router.get("/{tx_id}", response_model=TransactionResponse)
def get_transaction(tx_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    tx = db.query(Transaction).get(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return _tx_to_response(tx, db)


@router.put("/{tx_id}", response_model=TransactionResponse)
def update_transaction(tx_id: int, req: TransactionUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    tx = db.query(Transaction).get(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    for field, value in req.model_dump(exclude_unset=True).items():
        setattr(tx, field, value)
    db.commit()
    db.refresh(tx)
    return _tx_to_response(tx, db)


@router.delete("/{tx_id}")
def delete_transaction(tx_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    tx = db.query(Transaction).get(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    # If deleting a split child, check if parent has other children
    if tx.parent_id:
        siblings = db.query(Transaction).filter(
            Transaction.parent_id == tx.parent_id, Transaction.id != tx.id
        ).count()
        if siblings == 0:
            # Unsplit the parent
            parent = db.query(Transaction).get(tx.parent_id)
            if parent:
                parent.is_split = False
    db.delete(tx)
    db.commit()
    return {"message": "Transaction deleted"}


@router.post("/{tx_id}/split", response_model=TransactionResponse)
def split_transaction(tx_id: int, children: list[TransactionSplitChild], db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Split a transaction into multiple child entries."""
    tx = db.query(Transaction).get(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx.is_split:
        raise HTTPException(status_code=400, detail="Transaction is already split")
    if tx.parent_id:
        raise HTTPException(status_code=400, detail="Cannot split a child transaction")

    # Validate children sum to parent amount
    child_sum = sum(c.amount for c in children)
    if abs(child_sum - tx.amount) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Children sum ({child_sum}) must equal parent amount ({tx.amount})"
        )

    tx.is_split = True
    for child_data in children:
        child = Transaction(
            account_id=tx.account_id,
            parent_id=tx.id,
            date=tx.date,
            description=child_data.description or tx.description,
            amount=child_data.amount,
            balance=None,
            direction=tx.direction,
            flow_type=child_data.flow_type or tx.flow_type,
            income_type=child_data.income_type,
            tier=child_data.tier,
            category_id=child_data.category_id,
            item=child_data.item,
            source_file_id=tx.source_file_id,
        )
        db.add(child)

    db.commit()
    db.refresh(tx)
    return _tx_to_response(tx, db)


@router.post("/bulk-categorise")
def bulk_categorise(req: BulkCategoriseRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Assign category and tier to multiple transactions at once."""
    cat = db.query(Category).get(req.category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    updated = 0
    for tx_id in req.transaction_ids:
        tx = db.query(Transaction).get(tx_id)
        if tx:
            tx.category_id = req.category_id
            if req.tier:
                tx.tier = req.tier
            elif cat.default_tier:
                tx.tier = cat.default_tier
            updated += 1

    db.commit()
    return {"updated": updated}


@router.post("/bulk-delete")
def bulk_delete(req: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Delete multiple transactions at once."""
    tx_ids = req.get("transaction_ids", [])
    if not tx_ids:
        raise HTTPException(status_code=400, detail="No transaction IDs provided")

    deleted = 0
    for tx_id in tx_ids:
        tx = db.query(Transaction).get(tx_id)
        if tx:
            # Handle split children
            if tx.parent_id:
                siblings = db.query(Transaction).filter(
                    Transaction.parent_id == tx.parent_id, Transaction.id != tx.id
                ).count()
                if siblings == 0:
                    parent = db.query(Transaction).get(tx.parent_id)
                    if parent:
                        parent.is_split = False
            db.delete(tx)
            deleted += 1

    db.commit()
    return {"deleted": deleted}
