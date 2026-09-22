"""Pydantic request and response contracts for LifeStrategy persistence."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class PlayerCreate(BaseModel):
    player_id: str | None = Field(default=None, max_length=80)
    name: str = Field(default="Player", min_length=1, max_length=120)


class PlayerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    created_at: datetime
    updated_at: datetime


class SavePayload(BaseModel):
    player_id: str = Field(min_length=1, max_length=80)
    save_version: int = Field(default=1, ge=1)
    state: dict[str, Any] = Field(default_factory=dict)


class SaveRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    player_id: str
    save_version: int
    current_month: int
    current_chapter: str
    cash: float
    savings: float
    emergency_fund: float
    investments: float
    debt: float
    salary: float
    wealth_score: float
    security_score: float
    lifestyle_score: float
    growth_score: float
    goals_score: float
    level: int
    xp: int
    current_location: str
    current_event: str | None
    updated_at: datetime
    state: dict[str, Any]


class GameActionCreate(BaseModel):
    player_id: str = Field(min_length=1, max_length=80)
    game_month: int = Field(ge=1, le=12)
    action_type: str = Field(min_length=1, max_length=80)
    action_title: str = Field(min_length=1, max_length=180)
    action_description: str = ""
    amount: float | None = None
    metadata: dict[str, Any] | None = None
    client_action_id: str | None = Field(default=None, max_length=160)


class GameActionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    player_id: str
    game_month: int
    action_type: str
    action_title: str
    action_description: str
    amount: float | None
    metadata: dict[str, Any] | None = None
    client_action_id: str | None
    created_at: datetime


class TransactionCreate(BaseModel):
    player_id: str = Field(min_length=1, max_length=80)
    game_month: int = Field(ge=1, le=12)
    transaction_type: str = Field(min_length=1, max_length=80)
    category: str = Field(default="general", max_length=100)
    amount: float
    balance_after: float | None = None
    description: str = ""
    client_transaction_id: str | None = Field(default=None, max_length=160)


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    player_id: str
    game_month: int
    transaction_type: str
    category: str
    amount: float
    balance_after: float | None
    description: str
    client_transaction_id: str | None
    created_at: datetime


class CompletedEventCreate(BaseModel):
    player_id: str = Field(min_length=1, max_length=80)
    event_id: str = Field(min_length=1, max_length=140)
    event_name: str = Field(min_length=1, max_length=180)
    game_month: int = Field(ge=1, le=12)
    choice_id: str = Field(default="selected", max_length=140)
    choice_text: str = ""
    consequence: dict[str, Any] | None = None


class CompletedEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    player_id: str
    event_id: str
    event_name: str
    game_month: int
    choice_id: str
    choice_text: str
    consequence: dict[str, Any] | None = None
    completed_at: datetime
