from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Transaction
from schemas import TransactionCreate, TransactionRead


router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.get("/{player_id}", response_model=list[TransactionRead])
def get_transactions(player_id: str, db: Session = Depends(get_db)) -> list[Transaction]:
    return (
        db.query(Transaction)
        .filter(Transaction.player_id == player_id)
        .order_by(Transaction.game_month.asc(), Transaction.created_at.asc(), Transaction.id.asc())
        .all()
    )


@router.post("", response_model=TransactionRead)
def record_transaction(payload: TransactionCreate, db: Session = Depends(get_db)) -> Transaction:
    existing = None
    if payload.client_transaction_id:
        existing = db.query(Transaction).filter(Transaction.client_transaction_id == payload.client_transaction_id).one_or_none()
    if existing:
        return existing
    transaction = Transaction(
        player_id=payload.player_id,
        game_month=payload.game_month,
        transaction_type=payload.transaction_type,
        category=payload.category,
        amount=payload.amount,
        balance_after=payload.balance_after,
        description=payload.description,
        client_transaction_id=payload.client_transaction_id,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction
