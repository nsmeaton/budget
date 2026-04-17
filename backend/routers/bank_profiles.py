"""Bank Profiles router — manage saved CSV column mappings."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import BankProfile, Account, User
from ..schemas import BankProfileCreate, BankProfileUpdate, BankProfileSchema
from ..auth import get_current_user

router = APIRouter(prefix="/api/bank-profiles", tags=["bank-profiles"])


@router.get("/{account_id}", response_model=BankProfileSchema)
def get_profile(account_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    profile = db.query(BankProfile).filter(BankProfile.account_id == account_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No bank profile for this account")
    return profile


@router.post("", response_model=BankProfileSchema)
def create_profile(req: BankProfileCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    account = db.query(Account).get(req.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    existing = db.query(BankProfile).filter(BankProfile.account_id == req.account_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Profile already exists for this account")
    profile = BankProfile(**req.model_dump())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.put("/{account_id}", response_model=BankProfileSchema)
def update_profile(account_id: int, req: BankProfileUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    profile = db.query(BankProfile).filter(BankProfile.account_id == account_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No bank profile for this account")
    for field, value in req.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/{account_id}")
def delete_profile(account_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    profile = db.query(BankProfile).filter(BankProfile.account_id == account_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No bank profile for this account")
    db.delete(profile)
    db.commit()
    return {"message": "Bank profile deleted"}
