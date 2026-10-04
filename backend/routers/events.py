from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import CompletedEvent
from schemas import CompletedEventCreate, CompletedEventRead


router = APIRouter(prefix="/api/events", tags=["events"])


def _read(event: CompletedEvent) -> CompletedEventRead:
    try:
        consequence = json.loads(event.consequence_json) if event.consequence_json else None
    except json.JSONDecodeError:
        consequence = None
    return CompletedEventRead(
        id=event.id,
        player_id=event.player_id,
        event_id=event.event_id,
        event_name=event.event_name,
        game_month=event.game_month,
        choice_id=event.choice_id,
        choice_text=event.choice_text,
        consequence=consequence,
        completed_at=event.completed_at,
    )


@router.get("/completed/{player_id}", response_model=list[CompletedEventRead])
def get_completed_events(player_id: str, db: Session = Depends(get_db)) -> list[CompletedEventRead]:
    events = (
        db.query(CompletedEvent)
        .filter(CompletedEvent.player_id == player_id)
        .order_by(CompletedEvent.game_month.asc(), CompletedEvent.completed_at.asc())
        .all()
    )
    return [_read(event) for event in events]


@router.post("/completed", response_model=CompletedEventRead)
def record_completed_event(payload: CompletedEventCreate, db: Session = Depends(get_db)) -> CompletedEventRead:
    event = (
        db.query(CompletedEvent)
        .filter(
            CompletedEvent.player_id == payload.player_id,
            CompletedEvent.event_id == payload.event_id,
            CompletedEvent.game_month == payload.game_month,
        )
        .one_or_none()
    )
    if event:
        return _read(event)
    event = CompletedEvent(
        player_id=payload.player_id,
        event_id=payload.event_id,
        event_name=payload.event_name,
        game_month=payload.game_month,
        choice_id=payload.choice_id,
        choice_text=payload.choice_text,
        consequence_json=json.dumps(payload.consequence, ensure_ascii=False, separators=(",", ":")) if payload.consequence is not None else None,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return _read(event)
