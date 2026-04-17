"""Seed default categories and category groups."""
from sqlalchemy.orm import Session
from .models import CategoryGroup, Category


DEFAULT_CATEGORIES = {
    "Housing": [
        ("Rent / Mortgage", "Essential"),
        ("Council Tax", "Essential"),
        ("Home Insurance", "Essential"),
    ],
    "Utilities": [
        ("Gas / Electric", "Essential"),
        ("Water", "Essential"),
        ("Broadband", "Essential"),
        ("Mobile Phone", "Essential"),
    ],
    "Transport": [
        ("Fuel", "Essential"),
        ("Car Insurance", "Essential"),
        ("Car Maintenance", "Optional"),
        ("Public Transport", "Essential"),
        ("Parking", "Optional"),
    ],
    "Food & Drink": [
        ("Groceries", "Essential"),
        ("Eating Out", "Discretionary"),
        ("Takeaway", "Discretionary"),
        ("Coffee Shops", "Discretionary"),
    ],
    "Financial": [
        ("Loan Repayment", "Essential"),
        ("Credit Card Payment", "Essential"),
        ("Bank Fees", "Essential"),
    ],
    "Health": [
        ("Medical / Dental", "Essential"),
        ("Gym", "Discretionary"),
        ("Pharmacy", "Essential"),
    ],
    "Shopping": [
        ("Clothing", "Optional"),
        ("Household Items", "Optional"),
        ("Electronics", "Discretionary"),
        ("Gifts", "Optional"),
    ],
    "Entertainment": [
        ("Hobbies", "Discretionary"),
        ("Games", "Discretionary"),
        ("Music Equipment", "Discretionary"),
    ],
    "Subscriptions": [
        ("Netflix", "Discretionary"),
        ("Spotify", "Discretionary"),
        ("Amazon Prime", "Discretionary"),
    ],
    "Income": [
        ("Salary", None),
        ("Bonus", None),
        ("RSU", None),
        ("Investments", None),
    ],
    "Savings": [
        ("Savings", "Savings"),
        ("Investments Out", "Savings"),
    ],
    "Transfers": [
        ("Transfer", "Transfer"),
    ],
    "Other": [
        ("Childcare / School", "Essential"),
        ("Pet Costs", "Essential"),
        ("Holiday", "Discretionary"),
        ("Cash Withdrawal", None),
        ("General / Uncategorised", None),
    ],
}


def seed_categories(db: Session) -> None:
    """Seed default categories if none exist."""
    existing = db.query(CategoryGroup).count()
    if existing > 0:
        return

    for group_name, categories in DEFAULT_CATEGORIES.items():
        group = CategoryGroup(name=group_name)
        db.add(group)
        db.flush()

        for cat_name, default_tier in categories:
            category = Category(
                group_id=group.id,
                name=cat_name,
                default_tier=default_tier,
            )
            db.add(category)

    db.commit()
