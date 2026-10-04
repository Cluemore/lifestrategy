"""FastAPI entrypoint for LifeStrategy's durable game persistence."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from routers import events, history, players, saves, transactions


def _split_origins(value: str | None) -> list[str]:
    return [origin.strip().rstrip("/") for origin in (value or "").split(",") if origin.strip()]


def _cors_origins() -> list[str]:
    """Return the explicitly configured origins and fail closed in production."""

    configured = _split_origins(os.getenv("FRONTEND_URL")) + _split_origins(os.getenv("FRONTEND_ORIGINS"))
    app_env = os.getenv("APP_ENV", "development").strip().lower()
    origins = list(dict.fromkeys(configured))
    if app_env == "production" and not origins:
        raise RuntimeError("FRONTEND_URL or FRONTEND_ORIGINS must be configured when APP_ENV=production.")
    return origins


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="LifeStrategy API", version="1.0.0", description="Durable saves, actions, transactions and event decisions for LifeStrategy.", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "lifestrategy-api"}

    app.include_router(players.router)
    app.include_router(saves.router)
    app.include_router(history.router)
    app.include_router(transactions.router)
    app.include_router(events.router)
    return app


app = create_app()
