import json

import httpx
import pytest
from fastapi import HTTPException

from app import ai


@pytest.mark.asyncio
async def test_feedback_retries_transient_server_error_and_validates_json(monkeypatch):
    attempts = 0
    answer = {
        "items": [
            {
                "original": "I am go to class.",
                "corrected": "I am going to class.",
                "explanation": "Use the -ing form after am.",
                "alternative": "I'm heading to class.",
                "category": "grammar",
                "example": "I am studying now.",
                "exercise": "Write a sentence with 'am'.",
                "is_suggestion": False,
            }
        ]
    }

    def respond(_request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(503, json={"error": "temporary"})
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(answer)}}]})

    original_client = httpx.AsyncClient
    monkeypatch.setattr(ai.get_settings(), "openai_api_key", "test-key")
    monkeypatch.setattr(
        ai.httpx,
        "AsyncClient",
        lambda **kwargs: original_client(transport=httpx.MockTransport(respond), **kwargs),
    )

    result = await ai.generate_feedback("I am go to class.", "simple English")

    assert attempts == 2
    assert result.items[0].category == "grammar"
    assert result.items[0].corrected == "I am going to class."


@pytest.mark.asyncio
async def test_feedback_rejects_invalid_structured_response(monkeypatch):
    monkeypatch.setattr(ai.get_settings(), "openai_api_key", "test-key")
    original_client = httpx.AsyncClient
    transport = httpx.MockTransport(
        lambda _request: httpx.Response(200, json={"choices": [{"message": {"content": '{"items":[{"category":"pronunciation"}]}'}}]})
    )
    monkeypatch.setattr(
        ai.httpx,
        "AsyncClient",
        lambda **kwargs: original_client(transport=transport, **kwargs),
    )

    with pytest.raises(HTTPException) as raised:
        await ai.generate_feedback("My sentence.", "simple English")
    assert getattr(raised.value, "status_code", None) == 502
