"""End-to-end API contract test against an isolated SQLite file."""

from __future__ import annotations

import os
from pathlib import Path


TEST_DB = Path(__file__).resolve().parent / "test_lifestrategy.db"
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402


def test_save_history_transactions_events_resume() -> None:
    with TestClient(app) as client:
        player = client.post("/api/players", json={"player_id": "demo-player", "name": "Asha"})
        assert player.status_code == 200
        assert player.json()["name"] == "Asha"

        snapshot = {
            "saveVersion": 2,
            "hasActiveSession": True,
            "month": 2,
            "resumePhase": "world",
            "currentLocation": "bank",
            "activeEventId": "phone-repair",
            "state": {"cash": 16000, "savings": 25000, "emergencyFund": 3000, "investments": 4500, "debt": 0, "monthlyIncome": 38000},
            "scores": {"wealth": 42, "security": 39, "lifestyle": 37, "growth": 32, "goals": 8},
            "level": 2,
            "xp": 120,
            "strategicHistory": [{"id": "round-1", "agentId": "sam"}],
            "agents": [{"id": "sam", "unlocked": True}],
        }
        saved = client.post("/api/save", json={"player_id": "demo-player", "save_version": 2, "state": snapshot})
        assert saved.status_code == 200
        assert saved.json()["current_month"] == 2
        assert saved.json()["cash"] == 16000
        assert saved.json()["state"]["currentLocation"] == "bank"

        action = {"player_id": "demo-player", "game_month": 2, "action_type": "SAVINGS_DEPOSIT", "action_title": "Savings deposit", "action_description": "Moved cash to savings.", "amount": 5000, "client_action_id": "action-1"}
        assert client.post("/api/history", json=action).status_code == 200
        # The idempotency key makes retrying after a flaky connection safe.
        assert client.post("/api/history", json=action).json()["id"] == 1

        transaction = {"player_id": "demo-player", "game_month": 2, "transaction_type": "transfer", "category": "savings", "amount": 5000, "balance_after": 25000, "description": "Cash to savings", "client_transaction_id": "txn-1"}
        assert client.post("/api/transactions", json=transaction).status_code == 200

        event = {"player_id": "demo-player", "event_id": "phone-repair", "event_name": "Phone Repair", "game_month": 2, "choice_id": "repair-now", "choice_text": "Repair immediately", "consequence": {"cash": -4500}}
        assert client.post("/api/events/completed", json=event).status_code == 200

        assert len(client.get("/api/history/demo-player").json()) == 1
        assert len(client.get("/api/transactions/demo-player").json()) == 1
        assert len(client.get("/api/events/completed/demo-player").json()) == 1
        resumed = client.get("/api/save/demo-player")
        assert resumed.status_code == 200
        assert resumed.json()["state"]["strategicHistory"][0]["id"] == "round-1"


def teardown_module() -> None:
    if TEST_DB.exists():
        TEST_DB.unlink()
