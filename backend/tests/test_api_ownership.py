import asyncio
from collections.abc import AsyncGenerator
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app import main
from app.auth import current_user_id
from app.database import get_db
from app.models import Base
from app.schemas import PreferencesUpdate

USER_ONE = UUID("8288e3f6-9854-43fb-b1ce-c44c3cda5c21")
USER_TWO = UUID("3dd27fb9-80fd-4f67-885b-0e5b604301ce")


@pytest.fixture
def client(tmp_path, monkeypatch):
    database_path = tmp_path / "ownership.sqlite3"
    test_engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}", poolclass=NullPool)

    async def create_tables() -> None:
        async with test_engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

    asyncio.run(create_tables())
    sessions = async_sessionmaker(test_engine, expire_on_commit=False)
    actor = {"id": USER_ONE}

    async def override_db() -> AsyncGenerator[AsyncSession, None]:
        async with sessions() as session:
            yield session

    monkeypatch.setattr(main.settings, "environment", "test")
    main.app.dependency_overrides[get_db] = override_db
    main.app.dependency_overrides[current_user_id] = lambda: actor["id"]
    with TestClient(main.app) as test_client:
        yield test_client, actor
    main.app.dependency_overrides.clear()
    asyncio.run(test_engine.dispose())


def test_user_cannot_read_or_change_another_users_session_and_mistakes(client):
    test_client, actor = client
    created_session = test_client.post(
        "/api/sessions",
        json={"scenario": "project", "mode": "interview", "transcript_consent": False},
    )
    assert created_session.status_code == 200
    session_id = created_session.json()["id"]
    saved = test_client.post(
        "/api/mistakes",
        json={
            "session_id": session_id,
            "original": "I am go.",
            "corrected": "I am going.",
            "explanation": "Use the progressive form.",
            "alternative": "",
            "category": "grammar",
            "example": "I am going now.",
            "exercise": "Write another progressive sentence.",
            "is_suggestion": False,
        },
    )
    assert saved.status_code == 201
    mistake_id = saved.json()["id"]

    actor["id"] = USER_TWO
    assert test_client.get(f"/api/sessions/{session_id}").status_code == 404
    assert test_client.patch(f"/api/mistakes/{mistake_id}", json={"understood": True}).status_code == 404
    assert test_client.delete(f"/api/mistakes/{mistake_id}").status_code == 404
    assert test_client.get("/api/mistakes").json() == []


def test_transcripts_are_persisted_only_with_explicit_consent(client):
    test_client, _actor = client
    for consent in (False, True):
        created = test_client.post(
            "/api/sessions",
            json={"scenario": "daily", "mode": "conversation", "transcript_consent": consent},
        )
        assert created.status_code == 200
        session_id = created.json()["id"]
        completed = test_client.post(
            f"/api/sessions/{session_id}/complete",
            json={"turns": [{"speaker": "user", "content": "Hello there."}]},
        )
        assert completed.status_code == 200
        detail = test_client.get(f"/api/sessions/{session_id}").json()
        assert [turn["speaker"] for turn in detail["turns"]] == (["user"] if consent else [])
        assert [turn["content"] for turn in detail["turns"]] == (["Hello there."] if consent else [])
        assert detail["duration_seconds"] < 60
        assert test_client.post(
            f"/api/sessions/{session_id}/complete",
            json={"duration_seconds": 3600, "turns": []},
        ).status_code == 422


def test_preferences_reject_invalid_timezone():
    with pytest.raises(ValueError, match="valid IANA timezone"):
        PreferencesUpdate.model_validate({"timezone": "Not/A_Real_Zone"})


def test_unconfigured_ai_returns_an_explicit_error(client, monkeypatch):
    test_client, _actor = client
    monkeypatch.setattr(main.settings, "openai_api_key", "")
    response = test_client.post("/api/feedback", json={"text": "I am go to college."})
    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.json()["detail"]


def test_practice_exercise_uses_only_the_users_saved_note(client):
    test_client, _actor = client
    saved = test_client.post(
        "/api/mistakes",
        json={
            "original": "I am go to college.",
            "corrected": "I am going to college.",
            "explanation": "Use the progressive form.",
            "alternative": "",
            "category": "grammar",
            "example": "",
            "exercise": "",
            "is_suggestion": False,
        },
    )
    assert saved.status_code == 201

    response = test_client.post("/api/practice/exercise", json={})

    assert response.status_code == 200
    assert response.json()["self_check"] == {
        "original": "I am go to college.",
        "corrected": "I am going to college.",
        "explanation": "Use the progressive form.",
    }


def test_account_deletion_requires_server_side_provider_configuration(client, monkeypatch):
    test_client, _actor = client
    monkeypatch.setattr(main.settings, "supabase_service_role_key", "")
    response = test_client.request("DELETE", "/api/me", json={"confirmation": "DELETE"})
    assert response.status_code == 503
