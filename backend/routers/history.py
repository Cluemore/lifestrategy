from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import GameAction
from schemas import GameActionCreate, GameActionRead


router = APIRouter(prefix="/api/history", tags=["history"])


def _read(action: GameAction) -> GameActionRead:
    try:
        metadata = json.loads(action.metadata_json) if action.metadata_json else None
    except json.JSONDecodeError:
        metadata = None
    return GameActionRead(
        id=action.id,
        player_id=action.player_id,
        game_month=action.game_month,
        action_type=action.action_type,
        action_title=action.action_title,
        action_description=action.action_description,
        amount=action.amount,
        metadata=metadata,
        client_action_id=action.client_action_id,
        created_at=action.created_at,
    )


@router.get("/{player_id}", response_model=list[GameActionRead])
def get_history(player_id: str, db: Session = Depends(get_db)) -> list[GameActionRead]:
    actions = (
        db.query(GameAction)
        .filter(GameAction.player_id == player_id)
        .order_by(GameAction.game_month.asc(), GameAction.created_at.asc(), GameAction.id.asc())
        .all()
    )
    return [_read(action) for action in actions]


@router.post("", response_model=GameActionRead)
def record_action(payload: GameActionCreate, db: Session = Depends(get_db)) -> GameActionRead:
    existing = None
    if payload.client_action_id:
        existing = db.query(GameAction).filter(GameAction.client_action_id == payload.client_action_id).one_or_none()
    if existing:
        return _read(existing)
    action = GameAction(
        player_id=payload.player_id,
        game_month=payload.game_month,
        action_type=payload.action_type,
        action_title=payload.action_title,
        action_description=payload.action_description,
        amount=payload.amount,
        metadata_json=json.dumps(payload.metadata, ensure_ascii=False, separators=(",", ":")) if payload.metadata is not None else None,
        client_action_id=payload.client_action_id,
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return _read(action)
