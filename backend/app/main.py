from contextlib import asynccontextmanager
from datetime import datetime, time, timedelta, timezone
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import generate_feedback
from app.auth import current_user_id
from app.config import get_settings
from app.database import engine, get_db
from app.models import Base, ConversationTurn, DailyGoal, Mistake, PracticeSession, UserProfile
from app.prompts import tutor_instructions
from app.schemas import (
    AccountDelete,
    FeedbackRequest,
    MistakeCreate,
    MistakeOut,
    MistakePatch,
    PreferencesUpdate,
    RealtimeRequest,
    SessionComplete,
    SessionCreate,
    SessionOut,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.environment == "development" and settings.database_url.startswith("sqlite"):
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="SpeakIT AI API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


async def get_profile(db: AsyncSession, user_id: UUID) -> UserProfile:
    profile = await db.get(UserProfile, user_id)
    if profile is None:
        profile = UserProfile(id=user_id)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return profile


@app.get("/api/me")
async def me(user_id: UUID = Depends(current_user_id), db: AsyncSession = Depends(get_db)) -> dict:
    profile = await get_profile(db, user_id)
    return {"id": str(user_id), "display_name": profile.display_name, "english_level": profile.english_level}


@app.get("/api/me/export")
async def export_user_data(user_id: UUID = Depends(current_user_id), db: AsyncSession = Depends(get_db)) -> dict:
    profile = await get_profile(db, user_id)
    sessions = list(await db.scalars(
        select(PracticeSession).where(PracticeSession.user_id == user_id).order_by(PracticeSession.started_at)
    ))
    mistakes = list(await db.scalars(select(Mistake).where(Mistake.user_id == user_id).order_by(Mistake.created_at)))
    consented_session_ids = [session.id for session in sessions if session.transcript_consent]
    turns = []
    if consented_session_ids:
        turns = list(await db.scalars(
            select(ConversationTurn).where(ConversationTurn.session_id.in_(consented_session_ids)).order_by(ConversationTurn.created_at)
        ))
    return {
        "preferences": {
            "display_name": profile.display_name,
            "english_level": profile.english_level,
            "primary_goal": profile.primary_goal,
            "explanation_language": profile.explanation_language,
            "daily_target_minutes": profile.daily_target_minutes,
            "career_target": profile.career_target,
            "timezone": profile.timezone,
        },
        "sessions": [SessionOut.model_validate(item).model_dump(mode="json") for item in sessions],
        "transcript_turns": [
            {"session_id": str(item.session_id), "speaker": item.speaker, "content": item.content, "created_at": item.created_at}
            for item in turns
        ],
        "mistakes": [MistakeOut.model_validate(item).model_dump(mode="json") for item in mistakes],
    }


@app.delete("/api/me", status_code=204)
async def delete_account(
    body: AccountDelete,
    user_id: UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Response:
    if not settings.supabase_service_role_key:
        raise HTTPException(status_code=503, detail="Account deletion is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the backend.")
    try:
        async with httpx.AsyncClient(timeout=15, transport=httpx.AsyncHTTPTransport(retries=1)) as client:
            response = await client.delete(
                f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users/{user_id}",
                headers={
                    "apikey": settings.supabase_service_role_key,
                    "Authorization": f"Bearer {settings.supabase_service_role_key}",
                },
            )
            response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="Could not confirm account deletion with the authentication provider.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="The authentication provider could not delete this account.") from exc

    session_ids = select(PracticeSession.id).where(PracticeSession.user_id == user_id)
    await db.execute(delete(ConversationTurn).where(ConversationTurn.session_id.in_(session_ids)))
    await db.execute(delete(Mistake).where(Mistake.user_id == user_id))
    await db.execute(delete(DailyGoal).where(DailyGoal.user_id == user_id))
    await db.execute(delete(PracticeSession).where(PracticeSession.user_id == user_id))
    await db.execute(delete(UserProfile).where(UserProfile.id == user_id))
    await db.commit()
    return Response(status_code=204)


@app.get("/api/preferences")
async def preferences(user_id: UUID = Depends(current_user_id), db: AsyncSession = Depends(get_db)) -> dict:
    profile = await get_profile(db, user_id)
    return {
        "display_name": profile.display_name,
        "english_level": profile.english_level,
        "primary_goal": profile.primary_goal,
        "explanation_language": profile.explanation_language,
        "daily_target_minutes": profile.daily_target_minutes,
        "career_target": profile.career_target,
        "timezone": profile.timezone,
    }


@app.put("/api/preferences")
async def update_preferences(
    body: PreferencesUpdate,
    user_id: UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    profile = await get_profile(db, user_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await db.commit()
    return {"status": "saved"}


@app.post("/api/realtime-session")
async def create_realtime_session(
    body: RealtimeRequest,
    user_id: UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="Realtime voice is not configured. Add OPENAI_API_KEY to the backend environment.")
    profile = await get_profile(db, user_id)
    user_timezone = ZoneInfo(profile.timezone)
    local_start = datetime.combine(datetime.now(user_timezone).date(), time.min, tzinfo=user_timezone)
    day_start = local_start.astimezone(timezone.utc)
    used = await db.scalar(
        select(func.coalesce(func.sum(PracticeSession.duration_seconds), 0)).where(
            PracticeSession.user_id == user_id,
            PracticeSession.started_at >= day_start,
        )
    )
    voice_limit_seconds = max(0, settings.openai_daily_voice_minutes * 60 - int(used or 0))
    if voice_limit_seconds == 0:
        raise HTTPException(status_code=429, detail="Your configured daily voice-practice limit has been reached.")
    body_json = {
        "session": {
            "type": "realtime",
            "model": settings.openai_realtime_model,
            "instructions": tutor_instructions(
                profile.english_level, profile.primary_goal, body.mode, profile.explanation_language, body.scenario
            ),
            "audio": {
                "input": {"transcription": {"model": settings.openai_transcription_model}},
                "output": {"voice": "marin"},
            },
        }
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                "https://api.openai.com/v1/realtime/client_secrets",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json=body_json,
            )
            response.raise_for_status()
            payload = response.json()
            secret = payload.get("client_secret") or payload
            if not isinstance(secret, dict) or not secret.get("value"):
                raise HTTPException(status_code=502, detail="Realtime provider returned an invalid client credential.")
            return {
                "client_secret": secret["value"],
                "expires_at": secret.get("expires_at"),
                "max_duration_seconds": voice_limit_seconds,
            }
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="The voice service timed out. Please try again.") from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail="The voice provider could not start a session. Check provider access and model settings.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Could not connect to the voice provider.") from exc


@app.post("/api/feedback")
async def feedback(
    body: FeedbackRequest,
    user_id: UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    profile = await get_profile(db, user_id)
    if body.session_id:
        session = await db.scalar(
            select(PracticeSession).where(PracticeSession.id == body.session_id, PracticeSession.user_id == user_id)
        )
        if not session:
            raise HTTPException(status_code=404, detail="Practice session not found.")
    return (await generate_feedback(body.text, profile.explanation_language)).model_dump()


@app.post("/api/sessions", response_model=SessionOut)
async def create_session(
    body: SessionCreate,
    user_id: UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
) -> PracticeSession:
    session = PracticeSession(user_id=user_id, scenario=body.scenario, mode=body.mode, transcript_consent=body.transcript_consent)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@app.get("/api/sessions", response_model=list[SessionOut])
async def list_sessions(
    limit: int = Query(default=20, ge=1, le=100),
    user_id: UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[PracticeSession]:
    result = await db.scalars(
        select(PracticeSession).where(PracticeSession.user_id == user_id).order_by(desc(PracticeSession.started_at)).limit(limit)
    )
    return list(result)


@app.get("/api/sessions/{session_id}")
async def get_session(
    session_id: UUID,
    user_id: UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    session = await db.scalar(select(PracticeSession).where(PracticeSession.id == session_id, PracticeSession.user_id == user_id))
    if not session:
        raise HTTPException(status_code=404, detail="Practice session not found.")
    turns = []
    if session.transcript_consent:
        result = await db.scalars(select(ConversationTurn).where(ConversationTurn.session_id == session_id).order_by(ConversationTurn.created_at))
        turns = [{"speaker": turn.speaker, "content": turn.content, "created_at": turn.created_at} for turn in result]
    return {**SessionOut.model_validate(session).model_dump(), "turns": turns}


@app.post("/api/sessions/{session_id}/complete", response_model=SessionOut)
async def complete_session(
    session_id: UUID,
    body: SessionComplete,
    user_id: UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
) -> PracticeSession:
    session = await db.scalar(select(PracticeSession).where(PracticeSession.id == session_id, PracticeSession.user_id == user_id))
    if not session:
        raise HTTPException(status_code=404, detail="Practice session not found.")
    if session.completed:
        return session
    started_at = session.started_at
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    session.ended_at = datetime.now(timezone.utc)
    session.duration_seconds = min(3600, max(0, int((session.ended_at - started_at).total_seconds())))
    session.completed = True
    if session.transcript_consent:
        db.add_all(
            ConversationTurn(session_id=session.id, speaker=turn.speaker, content=turn.content)
            for turn in body.turns
        )
    await db.commit()
    await db.refresh(session)
    return session


@app.get("/api/mistakes", response_model=list[MistakeOut])
async def list_mistakes(
    search: str = Query(default="", max_length=100),
    category: str | None = Query(default=None, max_length=40),
    understood: bool | None = None,
    sort: Literal["newest", "oldest", "category"] = "newest",
    user_id: UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[Mistake]:
    query = select(Mistake).where(Mistake.user_id == user_id)
    if search:
        escaped = search.replace("%", r"\%").replace("_", r"\_")
        query = query.where(
            Mistake.original.ilike(f"%{escaped}%", escape="\\")
            | Mistake.corrected.ilike(f"%{escaped}%", escape="\\")
        )
    if category:
        query = query.where(Mistake.category == category)
    if understood is not None:
        query = query.where(Mistake.understood == understood)
    ordering = {
        "newest": desc(Mistake.created_at),
        "oldest": Mistake.created_at,
        "category": Mistake.category,
    }[sort]
    result = await db.scalars(query.order_by(ordering, desc(Mistake.created_at)).limit(200))
    return list(result)


@app.post("/api/mistakes", response_model=MistakeOut, status_code=201)
async def create_mistake(
    body: MistakeCreate,
    user_id: UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Mistake:
    if body.session_id:
        session = await db.scalar(select(PracticeSession).where(PracticeSession.id == body.session_id, PracticeSession.user_id == user_id))
        if not session:
            raise HTTPException(status_code=404, detail="Practice session not found.")
    mistake = Mistake(user_id=user_id, **body.model_dump())
    db.add(mistake)
    await db.commit()
    await db.refresh(mistake)
    return mistake


@app.patch("/api/mistakes/{mistake_id}", response_model=MistakeOut)
async def update_mistake(
    mistake_id: UUID,
    body: MistakePatch,
    user_id: UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Mistake:
    mistake = await db.scalar(select(Mistake).where(Mistake.id == mistake_id, Mistake.user_id == user_id))
    if not mistake:
        raise HTTPException(status_code=404, detail="Mistake not found.")
    mistake.understood = body.understood
    await db.commit()
    await db.refresh(mistake)
    return mistake


@app.delete("/api/mistakes/{mistake_id}", status_code=204)
async def delete_mistake(
    mistake_id: UUID,
    user_id: UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Response:
    mistake = await db.scalar(select(Mistake).where(Mistake.id == mistake_id, Mistake.user_id == user_id))
    if not mistake:
        raise HTTPException(status_code=404, detail="Mistake not found.")
    await db.delete(mistake)
    await db.commit()
    return Response(status_code=204)


@app.get("/api/analytics/summary")
async def analytics(
    user_id: UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    profile = await get_profile(db, user_id)
    user_timezone = ZoneInfo(profile.timezone)
    local_today_start = datetime.combine(datetime.now(user_timezone).date(), time.min, tzinfo=user_timezone)
    today_start = local_today_start.astimezone(timezone.utc)
    week_start = (local_today_start - timedelta(days=6)).astimezone(timezone.utc)
    today_seconds = await db.scalar(
        select(func.coalesce(func.sum(PracticeSession.duration_seconds), 0)).where(
            PracticeSession.user_id == user_id,
            PracticeSession.completed.is_(True),
            PracticeSession.started_at >= today_start,
        )
    )
    recent = list(await db.scalars(select(PracticeSession).where(
        PracticeSession.user_id == user_id,
        PracticeSession.completed.is_(True),
        PracticeSession.started_at >= week_start,
    )))
    sessions = list(await db.scalars(select(PracticeSession).where(
        PracticeSession.user_id == user_id,
        PracticeSession.completed.is_(True),
    )))
    mistakes = list(await db.scalars(select(Mistake).where(Mistake.user_id == user_id)))
    by_category: dict[str, int] = {}
    for item in mistakes:
        by_category[item.category] = by_category.get(item.category, 0) + 1
    return {
        "today_minutes": int(today_seconds or 0) // 60,
        "week_minutes": sum(session.duration_seconds for session in recent) // 60,
        "week_sessions": len(recent),
        "total_sessions": len(sessions),
        "mistake_categories": by_category,
        "note": "Language feedback is AI-generated guidance, not an objective English proficiency score.",
    }


@app.get("/api/learning-plan")
async def learning_plan(user_id: UUID = Depends(current_user_id), db: AsyncSession = Depends(get_db)) -> dict:
    profile = await get_profile(db, user_id)
    frequent = await db.scalar(
        select(Mistake.category).where(Mistake.user_id == user_id).group_by(Mistake.category).order_by(desc(func.count())).limit(1)
    )
    return {
        "focus": frequent or "clarity",
        "target_minutes": profile.daily_target_minutes,
        "level": profile.english_level,
        "activities": ["Have a short conversation", "Review one saved correction", "Explain a small project or idea"],
    }


@app.post("/api/practice/exercise")
async def practice_exercise(
    user_id: UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.scalars(select(Mistake).where(Mistake.user_id == user_id, Mistake.understood.is_(False)).order_by(desc(Mistake.created_at)).limit(5))
    items = list(result)
    if not items:
        return {"prompt": "Describe one thing you learned recently in three clear sentences.", "based_on_saved_mistakes": False}
    item = items[0]
    return {
        "prompt": f"Rewrite this sentence using what you learned about {item.category}: {item.original}",
        "based_on_saved_mistakes": True,
        "category": item.category,
        "self_check": {
            "original": item.original,
            "corrected": item.corrected,
            "explanation": item.explanation,
        },
    }
