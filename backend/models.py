"""Readable SQLAlchemy models used for the classroom-facing SQLite database."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Player(Base):
    __tablename__ = "players"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), default="Player")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class GameSave(Base):
    __tablename__ = "game_saves"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    player_id: Mapped[str] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"), unique=True, index=True)
    save_version: Mapped[int] = mapped_column(Integer, default=1)
    current_month: Mapped[int] = mapped_column(Integer, default=1)
    current_chapter: Mapped[str] = mapped_column(String(40), default="world")
    cash: Mapped[float] = mapped_column(Float, default=0)
    savings: Mapped[float] = mapped_column(Float, default=0)
    emergency_fund: Mapped[float] = mapped_column(Float, default=0)
    investments: Mapped[float] = mapped_column(Float, default=0)
    debt: Mapped[float] = mapped_column(Float, default=0)
    salary: Mapped[float] = mapped_column(Float, default=0)
    wealth_score: Mapped[float] = mapped_column(Float, default=0)
    security_score: Mapped[float] = mapped_column(Float, default=0)
    lifestyle_score: Mapped[float] = mapped_column(Float, default=0)
    growth_score: Mapped[float] = mapped_column(Float, default=0)
    goals_score: Mapped[float] = mapped_column(Float, default=0)
    level: Mapped[int] = mapped_column(Integer, default=1)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    current_location: Mapped[str] = mapped_column(String(40), default="home")
    current_event: Mapped[str | None] = mapped_column(String(120), nullable=True)
    current_agent_state: Mapped[str | None] = mapped_column(Text, nullable=True)
    game_state_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class GameAction(Base):
    __tablename__ = "game_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    player_id: Mapped[str] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"), index=True)
    game_month: Mapped[int] = mapped_column(Integer, index=True)
    action_type: Mapped[str] = mapped_column(String(80), index=True)
    action_title: Mapped[str] = mapped_column(String(180))
    action_description: Mapped[str] = mapped_column(Text, default="")
    amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    client_action_id: Mapped[str | None] = mapped_column(String(160), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    player_id: Mapped[str] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"), index=True)
    game_month: Mapped[int] = mapped_column(Integer, index=True)
    transaction_type: Mapped[str] = mapped_column(String(80), index=True)
    category: Mapped[str] = mapped_column(String(100), default="general")
    amount: Mapped[float] = mapped_column(Float)
    balance_after: Mapped[float | None] = mapped_column(Float, nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    client_transaction_id: Mapped[str | None] = mapped_column(String(160), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class CompletedEvent(Base):
    __tablename__ = "completed_events"
    __table_args__ = (UniqueConstraint("player_id", "event_id", "game_month", name="uq_player_event_month"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    player_id: Mapped[str] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"), index=True)
    event_id: Mapped[str] = mapped_column(String(140), index=True)
    event_name: Mapped[str] = mapped_column(String(180))
    game_month: Mapped[int] = mapped_column(Integer, index=True)
    choice_id: Mapped[str] = mapped_column(String(140), default="selected")
    choice_text: Mapped[str] = mapped_column(Text, default="")
    consequence_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
