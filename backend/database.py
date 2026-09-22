"""SQLite connection and session helpers for the LifeStrategy API."""

from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


BASE_DIR = Path(__file__).resolve().parent
# Railway supplies real environment variables. Loading this optional local file
# only makes copying backend/.env.example convenient during development.
load_dotenv(BASE_DIR / ".env", override=False)


def _database_url() -> str:
    """Return the deployable database URL, retaining the old name as a fallback."""

    return (
        os.getenv("DATABASE_URL")
        or os.getenv("LIFESTRATEGY_DATABASE_URL")
        or f"sqlite:///{BASE_DIR / 'lifestrategy.db'}"
    ).strip()


DATABASE_URL = _database_url()


def _ensure_sqlite_parent_directory() -> None:
    """Create a configured SQLite directory before SQLAlchemy opens the file.

    Railway mounts the persistent volume at runtime, so this intentionally runs
    during application import/startup rather than during the image build.
    """

    url = make_url(DATABASE_URL)
    if not url.drivername.startswith("sqlite") or not url.database or url.database == ":memory:":
        return
    Path(url.database).expanduser().parent.mkdir(parents=True, exist_ok=True)


_ensure_sqlite_parent_directory()
CONNECT_ARGS = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=CONNECT_ARGS, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    # Import registers SQLAlchemy mappings before metadata is created.
    import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
