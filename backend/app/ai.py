import asyncio
import json

import httpx
from fastapi import HTTPException
from pydantic import ValidationError

from app.config import get_settings
from app.prompts import FEEDBACK_SYSTEM_PROMPT
from app.schemas import FeedbackResponse

FEEDBACK_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "original": {"type": "string"},
                    "corrected": {"type": "string"},
                    "explanation": {"type": "string"},
                    "alternative": {"type": "string"},
                    "category": {
                        "type": "string",
                        "enum": [
                            "grammar", "tense", "agreement", "articles_prepositions",
                            "structure", "vocabulary", "word_order", "filler", "clarity",
                        ],
                    },
                    "example": {"type": "string"},
                    "exercise": {"type": "string"},
                    "is_suggestion": {"type": "boolean"},
                },
                "required": ["original", "corrected", "explanation", "alternative", "category", "example", "exercise", "is_suggestion"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["items"],
    "additionalProperties": False,
}


async def generate_feedback(text: str, explanation_language: str) -> FeedbackResponse:
    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="AI feedback is not configured. Add OPENAI_API_KEY to the backend environment.")
    request_body = {
        "model": settings.openai_feedback_model,
        "messages": [
            {"role": "system", "content": FEEDBACK_SYSTEM_PROMPT + f" Write explanations in {explanation_language}."},
            {"role": "user", "content": json.dumps({"learner_text": text}, ensure_ascii=False)},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": "english_feedback", "strict": True, "schema": FEEDBACK_SCHEMA},
        },
        "temperature": 0.2,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        for attempt in range(2):
            try:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json=request_body,
                )
                if response.status_code >= 500 and attempt == 0:
                    await asyncio.sleep(0.25)
                    continue
                response.raise_for_status()
                raw = response.json()["choices"][0]["message"]["content"]
                return FeedbackResponse.model_validate_json(raw)
            except httpx.TimeoutException as exc:
                if attempt == 0:
                    await asyncio.sleep(0.25)
                    continue
                raise HTTPException(status_code=504, detail="The feedback service took too long. Please try again.") from exc
            except httpx.TransportError as exc:
                if attempt == 0:
                    await asyncio.sleep(0.25)
                    continue
                raise HTTPException(status_code=502, detail="Could not connect to the feedback provider.") from exc
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 429:
                    raise HTTPException(status_code=429, detail="AI feedback is temporarily rate limited. Try again shortly.") from exc
                raise HTTPException(status_code=502, detail="The feedback provider could not complete this request.") from exc
            except (json.JSONDecodeError, KeyError, IndexError, ValidationError) as exc:
                raise HTTPException(status_code=502, detail="The feedback provider returned an unusable response.") from exc
    raise HTTPException(status_code=502, detail="The feedback provider could not complete this request.")
