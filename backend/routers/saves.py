from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from database import get_db
from models import GameSave, Player
from schemas import SavePayload, SaveRead


router = APIRouter(prefix="/api", tags=["saves"])


def _number(value: Any, fallback: float = 0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _save_values(payload: SavePayload) -> dict[str, Any]:
    state = payload.state if isinstance(payload.state, dict) else {}
    finances = state.get("state") if isinstance(state.get("state"), dict) else {}
    scores = state.get("scores") if isinstance(state.get("scores"), dict) else {}
    agents = state.get("agents") if isinstance(state.get("agents"), list) else []
    return {
        "save_version": max(1, payload.save_version),
        "current_month": int(state.get("month", 1) or 1),
        "current_chapter": str(state.get("resumePhase") or state.get("phase") or "world"),
        "cash": _number(finances.get("cash")),
        "savings": _number(finances.get("savings")),
        "emergency_fund": _number(finances.get("emergencyFund")),
        "investments": _number(finances.get("investments")),
        "debt": _number(finances.get("debt")),
        "salary": _number(finances.get("monthlyIncome")),
        "wealth_score": _number(scores.get("wealth")),
        "security_score": _number(scores.get("security")),
        "lifestyle_score": _number(scores.get("lifestyle")),
        "growth_score": _number(scores.get("growth")),
        "goals_score": _number(scores.get("goals")),
        "level": int(state.get("level", 1) or 1),
        "xp": int(state.get("xp", 0) or 0),
        "current_location": str(state.get("currentLocation") or "home"),
        "current_event": state.get("activeEventId") if isinstance(state.get("activeEventId"), str) else None,
        "current_agent_state": json.dumps(agents, ensure_ascii=False, separators=(",", ":")),
        "game_state_json": json.dumps(state, ensure_ascii=False, separators=(",", ":")),
    }


def _read(save: GameSave) -> SaveRead:
    try:
        state = json.loads(save.game_state_json)
    except (TypeError, json.JSONDecodeError):
        state = {}
    return SaveRead(
        player_id=save.player_id,
        save_version=save.save_version,
        current_month=save.current_month,
        current_chapter=save.current_chapter,
        cash=save.cash,
        savings=save.savings,
        emergency_fund=save.emergency_fund,
        investments=save.investments,
        debt=save.debt,
        salary=save.salary,
        wealth_score=save.wealth_score,
        security_score=save.security_score,
        lifestyle_score=save.lifestyle_score,
        growth_score=save.growth_score,
        goals_score=save.goals_score,
        level=save.level,
        xp=save.xp,
        current_location=save.current_location,
        current_event=save.current_event,
        updated_at=save.updated_at,
        state=state if isinstance(state, dict) else {},
    )


def _upsert(payload: SavePayload, db: Session) -> GameSave:
    player = db.get(Player, payload.player_id)
    if not player:
        name = payload.state.get("profile", {}).get("name", "Player") if isinstance(payload.state.get("profile"), dict) else "Player"
        player = Player(id=payload.player_id, name=str(name)[:120] or "Player")
        db.add(player)
    values = _save_values(payload)
    save = db.query(GameSave).filter(GameSave.player_id == payload.player_id).one_or_none()
    if save:
        for key, value in values.items():
            setattr(save, key, value)
    else:
        save = GameSave(player_id=payload.player_id, **values)
        db.add(save)
    db.commit()
    db.refresh(save)
    return save


@router.get("/save/{player_id}", response_model=SaveRead)
def get_save(player_id: str, db: Session = Depends(get_db)) -> SaveRead:
    save = db.query(GameSave).filter(GameSave.player_id == player_id).one_or_none()
    if not save:
        raise HTTPException(status_code=404, detail="No save for this player")
    return _read(save)


@router.post("/save", response_model=SaveRead)
def save_game(payload: SavePayload, db: Session = Depends(get_db)) -> SaveRead:
    return _read(_upsert(payload, db))


@router.put("/save/{player_id}", response_model=SaveRead)
def update_save(player_id: str, payload: SavePayload, db: Session = Depends(get_db)) -> SaveRead:
    if payload.player_id != player_id:
        raise HTTPException(status_code=400, detail="player_id does not match save path")
    return _read(_upsert(payload, db))


@router.delete("/save/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_save(player_id: str, db: Session = Depends(get_db)) -> Response:
    save = db.query(GameSave).filter(GameSave.player_id == player_id).one_or_none()
    if save:
        db.delete(save)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
