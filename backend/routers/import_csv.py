"""CSV Import router — upload, preview, map columns, detect duplicates, auto-categorise."""
import csv
import io
from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..database import get_db
from ..models import Transaction, Account, BankProfile, UploadedFile, Rule, User
from ..schemas import (
    CSVPreviewResponse, ImportMappingRequest, ImportResult,
    ImportConfirmRequest, DuplicateCandidate,
)
from ..auth import get_current_user
from .rules import apply_rules

router = APIRouter(prefix="/api/import", tags=["import"])

# Temporary storage for import sessions (in production, use Redis or DB)
_import_sessions: dict = {}

DATE_FORMATS = {
    "DD/MM/YYYY": "%d/%m/%Y",
    "DD-MM-YYYY": "%d-%m-%Y",
    "YYYY-MM-DD": "%Y-%m-%d",
    "MM/DD/YYYY": "%m/%d/%Y",
    "DD/MM/YY": "%d/%m/%y",
    "DD Mon YYYY": "%d %b %Y",
}


def parse_date(date_str: str, fmt: str) -> Optional[date]:
    """Parse a date string using the configured format."""
    py_fmt = DATE_FORMATS.get(fmt, fmt)
    try:
        return datetime.strptime(date_str.strip(), py_fmt).date()
    except (ValueError, AttributeError):
        return None


def parse_amount(value: str) -> Optional[float]:
    """Parse an amount string, handling £ signs and commas."""
    if not value:
        return None
    cleaned = value.strip().replace("£", "").replace(",", "").replace(" ", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


@router.post("/preview", response_model=CSVPreviewResponse)
async def preview_csv(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """Upload a CSV and return the first 5 rows for column mapping."""
    content = await file.read()
    text = content.decode("utf-8-sig")  # Handle BOM
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)

    if not rows:
        raise HTTPException(status_code=400, detail="CSV is empty")

    headers = rows[0] if rows else []
    preview_rows = rows[1:6] if len(rows) > 1 else []
    total = len(rows) - 1  # Exclude header

    # Store the full content for later import
    session_id = str(id(content))
    _import_sessions[session_id] = {
        "content": text,
        "filename": file.filename,
        "raw_bytes": content,
    }

    return CSVPreviewResponse(
        headers=headers,
        rows=preview_rows,
        total_rows=total,
    )


@router.post("/process")
async def process_import(
    file: UploadFile = File(...),
    account_id: int = Form(...),
    date_column: int = Form(...),
    description_column: int = Form(...),
    amount_column: Optional[int] = Form(None),
    debit_column: Optional[int] = Form(None),
    credit_column: Optional[int] = Form(None),
    balance_column: Optional[int] = Form(None),
    date_format: str = Form("DD/MM/YYYY"),
    has_header: bool = Form(True),
    save_profile: bool = Form(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Process CSV import with column mapping. Detects duplicates and applies rules."""
    # Build a request-like object for compatibility
    class Req:
        pass
    req = Req()
    req.account_id = account_id
    req.date_column = date_column
    req.description_column = description_column
    req.amount_column = amount_column
    req.debit_column = debit_column
    req.credit_column = credit_column
    req.balance_column = balance_column
    req.date_format = date_format
    req.has_header = has_header
    req.save_profile = save_profile

    # Get CSV content
    content = await file.read()
    text = content.decode("utf-8-sig")
    raw_bytes = content
    filename = file.filename

    # Verify account exists
    account = db.query(Account).get(req.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Save bank profile if requested
    if req.save_profile:
        existing_profile = db.query(BankProfile).filter(
            BankProfile.account_id == req.account_id
        ).first()
        if existing_profile:
            existing_profile.date_column = req.date_column
            existing_profile.description_column = req.description_column
            existing_profile.amount_column = req.amount_column
            existing_profile.debit_column = req.debit_column
            existing_profile.credit_column = req.credit_column
            existing_profile.balance_column = req.balance_column
            existing_profile.date_format = req.date_format
            existing_profile.has_header = req.has_header
        else:
            profile = BankProfile(
                account_id=req.account_id,
                date_column=req.date_column,
                description_column=req.description_column,
                amount_column=req.amount_column,
                debit_column=req.debit_column,
                credit_column=req.credit_column,
                balance_column=req.balance_column,
                date_format=req.date_format,
                has_header=req.has_header,
            )
            db.add(profile)

    # Parse CSV
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if req.has_header and rows:
        rows = rows[1:]

    # Store encrypted file
    from cryptography.fernet import Fernet
    import os
    key = os.environ.get("BUDGET_ENCRYPTION_KEY")
    if not key:
        key = Fernet.generate_key().decode()
        os.environ["BUDGET_ENCRYPTION_KEY"] = key
    fernet = Fernet(key.encode() if isinstance(key, str) else key)
    encrypted = fernet.encrypt(raw_bytes)

    uploaded_file = UploadedFile(
        account_id=req.account_id,
        filename=filename or "import.csv",
        encrypted_data=encrypted,
        transaction_count=0,
    )
    db.add(uploaded_file)
    db.flush()

    # Process rows
    imported = 0
    auto_categorised = 0
    needs_review = 0
    duplicates = []
    uncategorised_ids = []
    transactions_to_add = []

    for row_idx, row in enumerate(rows):
        if not row or all(c.strip() == "" for c in row):
            continue

        # Extract fields
        try:
            date_str = row[req.date_column].strip()
        except IndexError:
            continue

        tx_date = parse_date(date_str, req.date_format)
        if not tx_date:
            continue

        try:
            description = row[req.description_column].strip()
        except IndexError:
            continue

        if not description:
            continue

        # Parse amount
        amount = None
        if req.amount_column is not None:
            amount = parse_amount(row[req.amount_column] if req.amount_column < len(row) else "")
        elif req.debit_column is not None and req.credit_column is not None:
            debit = parse_amount(row[req.debit_column] if req.debit_column < len(row) else "")
            credit = parse_amount(row[req.credit_column] if req.credit_column < len(row) else "")
            if credit and credit > 0:
                amount = credit
            elif debit and debit > 0:
                amount = -debit
            elif debit:
                amount = debit

        if amount is None:
            continue

        # Parse balance
        balance = None
        if req.balance_column is not None and req.balance_column < len(row):
            balance = parse_amount(row[req.balance_column])

        direction = "in" if amount > 0 else "out"

        # Check duplicates
        existing = db.query(Transaction).filter(
            Transaction.account_id == req.account_id,
            Transaction.date == tx_date,
            Transaction.description == description,
            Transaction.amount == amount,
        ).first()

        if existing:
            duplicates.append(DuplicateCandidate(
                csv_row=row_idx,
                date=str(tx_date),
                description=description,
                amount=amount,
                existing_id=existing.id,
                existing_date=str(existing.date),
                existing_description=existing.description,
                existing_amount=existing.amount,
            ))
            continue

        # Apply rules
        matching_rules = apply_rules(db, description)

        category_id = None
        tier = None
        rule_id = None
        flow_type = "spending" if direction == "out" else "income"

        if len(matching_rules) == 1:
            rule = matching_rules[0]
            category_id = rule.category_id
            tier = rule.default_tier
            rule_id = rule.id
            auto_categorised += 1
        elif len(matching_rules) > 1:
            # Conflicting rules — leave uncategorised, flag for review
            needs_review += 1
        else:
            needs_review += 1

        tx = Transaction(
            account_id=req.account_id,
            date=tx_date,
            description=description,
            amount=amount,
            balance=balance,
            direction=direction,
            flow_type=flow_type,
            tier=tier,
            category_id=category_id,
            rule_id=rule_id,
            source_file_id=uploaded_file.id,
        )
        db.add(tx)
        db.flush()

        if not category_id:
            uncategorised_ids.append(tx.id)

        imported += 1

    uploaded_file.transaction_count = imported
    db.commit()

    return ImportResult(
        total_rows=len(rows),
        imported=imported,
        auto_categorised=auto_categorised,
        needs_review=needs_review,
        duplicates_flagged=len(duplicates),
        duplicate_candidates=duplicates,
        uncategorised_ids=uncategorised_ids,
    )
