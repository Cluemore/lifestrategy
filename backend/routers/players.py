from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Player
from schemas import PlayerCreate, PlayerRead


router = APIRouter(prefix="/api/players", tags=["players"])


@router.post("", response_model=PlayerRead)
def create_or_update_player(payload: PlayerCreate, db: Session = Depends(get_db)) -> Player:
    player_id = payload.player_id or str(uuid4())
    player = db.get(Player, player_id)
    if player:
        player.name = payload.name.strip() or player.name
    else:
        player = Player(id=player_id, name=payload.name.strip() or "Player")
        db.add(player)
    db.commit()
    db.refresh(player)
    return player


@router.get("/{player_id}", response_model=PlayerRead)
def get_player(player_id: str, db: Session = Depends(get_db)) -> Player:
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return player
