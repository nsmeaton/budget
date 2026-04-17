"""Rules router — CRUD for auto-categorisation rules."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import Rule, Category, Transaction, User
from ..schemas import RuleCreate, RuleUpdate, RuleResponse
from ..auth import get_current_user

router = APIRouter(prefix="/api/rules", tags=["rules"])


@router.get("", response_model=list[RuleResponse])
def list_rules(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rules = db.query(Rule).all()
    result = []
    for r in rules:
        matched = db.query(func.count(Transaction.id)).filter(
            Transaction.rule_id == r.id
        ).scalar()
        result.append(RuleResponse(
            id=r.id, match_pattern=r.match_pattern, match_type=r.match_type,
            category_id=r.category_id,
            category_name=r.category.name if r.category else "",
            default_tier=r.default_tier, matched_count=matched,
            created_at=r.created_at,
        ))
    return result


@router.post("", response_model=RuleResponse)
def create_rule(req: RuleCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cat = db.query(Category).get(req.category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    if req.match_type not in ("contains", "starts_with", "exact"):
        raise HTTPException(status_code=400, detail="Invalid match_type")
    rule = Rule(
        match_pattern=req.match_pattern, match_type=req.match_type,
        category_id=req.category_id, default_tier=req.default_tier,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return RuleResponse(
        id=rule.id, match_pattern=rule.match_pattern, match_type=rule.match_type,
        category_id=rule.category_id, category_name=cat.name,
        default_tier=rule.default_tier, matched_count=0, created_at=rule.created_at,
    )


@router.put("/{rule_id}", response_model=RuleResponse)
def update_rule(rule_id: int, req: RuleUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rule = db.query(Rule).get(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    if req.match_pattern is not None:
        rule.match_pattern = req.match_pattern
    if req.match_type is not None:
        rule.match_type = req.match_type
    if req.category_id is not None:
        rule.category_id = req.category_id
    if req.default_tier is not None:
        rule.default_tier = req.default_tier
    db.commit()
    db.refresh(rule)
    matched = db.query(func.count(Transaction.id)).filter(Transaction.rule_id == rule.id).scalar()
    return RuleResponse(
        id=rule.id, match_pattern=rule.match_pattern, match_type=rule.match_type,
        category_id=rule.category_id,
        category_name=rule.category.name if rule.category else "",
        default_tier=rule.default_tier, matched_count=matched, created_at=rule.created_at,
    )


@router.delete("/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rule = db.query(Rule).get(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    # Clear rule_id from transactions that used this rule
    db.query(Transaction).filter(Transaction.rule_id == rule_id).update({"rule_id": None})
    db.delete(rule)
    db.commit()
    return {"message": "Rule deleted"}


def apply_rules(db: Session, description: str) -> list[Rule]:
    """Find all rules that match a given description. Returns list (may have conflicts)."""
    rules = db.query(Rule).all()
    matches = []
    desc_upper = description.upper()
    for rule in rules:
        pattern = rule.match_pattern.upper()
        if rule.match_type == "contains" and pattern in desc_upper:
            matches.append(rule)
        elif rule.match_type == "starts_with" and desc_upper.startswith(pattern):
            matches.append(rule)
        elif rule.match_type == "exact" and desc_upper == pattern:
            matches.append(rule)
    return matches
