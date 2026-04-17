"""Accounts router — CRUD for bank accounts."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import Account, BankProfile, Transaction, UploadedFile, User
from ..schemas import AccountCreate, AccountUpdate, AccountResponse
from ..auth import get_current_user

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountResponse])
def list_accounts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """List all accounts with summary stats."""
    accounts = db.query(Account).all()
    result = []
    for acct in accounts:
        tx_count = db.query(func.count(Transaction.id)).filter(
            Transaction.account_id == acct.id,
            Transaction.is_split == False
        ).scalar()

        last_import = db.query(func.max(UploadedFile.import_date)).filter(
            UploadedFile.account_id == acct.id
        ).scalar()

        # Get latest balance from most recent transaction
        latest_tx = db.query(Transaction).filter(
            Transaction.account_id == acct.id,
            Transaction.balance.isnot(None),
            Transaction.is_split == False,
        ).order_by(Transaction.date.desc(), Transaction.id.desc()).first()

        result.append(AccountResponse(
            id=acct.id,
            bank_name=acct.bank_name,
            account_name=acct.account_name,
            created_at=acct.created_at,
            bank_profile=acct.bank_profile,
            transaction_count=tx_count,
            last_import_date=last_import,
            current_balance=latest_tx.balance if latest_tx else None,
        ))
    return result


@router.post("", response_model=AccountResponse)
def create_account(req: AccountCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    acct = Account(bank_name=req.bank_name, account_name=req.account_name)
    db.add(acct)
    db.commit()
    db.refresh(acct)
    return AccountResponse(
        id=acct.id, bank_name=acct.bank_name, account_name=acct.account_name,
        created_at=acct.created_at, transaction_count=0,
    )


@router.put("/{account_id}", response_model=AccountResponse)
def update_account(account_id: int, req: AccountUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    acct = db.query(Account).get(account_id)
    if not acct:
        raise HTTPException(status_code=404, detail="Account not found")
    if req.bank_name is not None:
        acct.bank_name = req.bank_name
    if req.account_name is not None:
        acct.account_name = req.account_name
    db.commit()
    db.refresh(acct)
    return AccountResponse(
        id=acct.id, bank_name=acct.bank_name, account_name=acct.account_name,
        created_at=acct.created_at,
    )


@router.delete("/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    acct = db.query(Account).get(account_id)
    if not acct:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete(acct)
    db.commit()
    return {"message": "Account deleted"}
