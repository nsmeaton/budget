"""Categories router — CRUD for categories and category groups."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import Category, CategoryGroup, Transaction, User
from ..schemas import (
    CategoryCreate, CategoryUpdate, CategoryResponse,
    CategoryGroupCreate, CategoryGroupResponse,
)
from ..auth import get_current_user

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("/groups", response_model=list[CategoryGroupResponse])
def list_groups(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """List all category groups with their categories and stats."""
    groups = db.query(CategoryGroup).all()
    result = []
    for g in groups:
        cats = []
        group_tx_count = 0
        group_spend = 0.0
        for c in g.categories:
            tx_count = db.query(func.count(Transaction.id)).filter(
                Transaction.category_id == c.id, Transaction.is_split == False
            ).scalar()
            total = db.query(func.coalesce(func.sum(Transaction.amount), 0.0)).filter(
                Transaction.category_id == c.id, Transaction.is_split == False,
                Transaction.direction == "out",
                Transaction.tier.notin_(["Savings", "Transfer"]),
            ).scalar()
            group_tx_count += tx_count
            group_spend += abs(total)
            cats.append(CategoryResponse(
                id=c.id, group_id=c.group_id, group_name=g.name,
                name=c.name, default_tier=c.default_tier,
                transaction_count=tx_count, total_spend=abs(total),
                created_at=c.created_at,
            ))
        result.append(CategoryGroupResponse(
            id=g.id, name=g.name, categories=cats,
            transaction_count=group_tx_count, total_spend=group_spend,
        ))
    return result


@router.get("", response_model=list[CategoryResponse])
def list_categories(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Flat list of all categories."""
    cats = db.query(Category).order_by(Category.name).all()
    result = []
    for c in cats:
        tx_count = db.query(func.count(Transaction.id)).filter(
            Transaction.category_id == c.id, Transaction.is_split == False
        ).scalar()
        total = db.query(func.coalesce(func.sum(Transaction.amount), 0.0)).filter(
            Transaction.category_id == c.id, Transaction.is_split == False,
            Transaction.direction == "out",
        ).scalar()
        result.append(CategoryResponse(
            id=c.id, group_id=c.group_id, group_name=c.group.name if c.group else "",
            name=c.name, default_tier=c.default_tier,
            transaction_count=tx_count, total_spend=abs(total),
            created_at=c.created_at,
        ))
    return result


@router.post("", response_model=CategoryResponse)
def create_category(req: CategoryCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    group = db.query(CategoryGroup).get(req.group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Category group not found")
    cat = Category(group_id=req.group_id, name=req.name, default_tier=req.default_tier)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return CategoryResponse(
        id=cat.id, group_id=cat.group_id, group_name=group.name,
        name=cat.name, default_tier=cat.default_tier,
        transaction_count=0, total_spend=0.0, created_at=cat.created_at,
    )


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(category_id: int, req: CategoryUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cat = db.query(Category).get(category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    if req.group_id is not None:
        cat.group_id = req.group_id
    if req.name is not None:
        cat.name = req.name
    if req.default_tier is not None:
        cat.default_tier = req.default_tier
    db.commit()
    db.refresh(cat)
    return CategoryResponse(
        id=cat.id, group_id=cat.group_id, group_name=cat.group.name,
        name=cat.name, default_tier=cat.default_tier,
        transaction_count=0, total_spend=0.0, created_at=cat.created_at,
    )


@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cat = db.query(Category).get(category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(cat)
    db.commit()
    return {"message": "Category deleted"}


@router.post("/groups", response_model=CategoryGroupResponse)
def create_group(req: CategoryGroupCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    group = CategoryGroup(name=req.name)
    db.add(group)
    db.commit()
    db.refresh(group)
    return CategoryGroupResponse(id=group.id, name=group.name, categories=[])


@router.delete("/groups/{group_id}")
def delete_group(group_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    group = db.query(CategoryGroup).get(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    db.delete(group)
    db.commit()
    return {"message": "Group deleted"}
