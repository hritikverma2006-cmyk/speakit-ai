from datetime import datetime
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PreferencesUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=100)
    english_level: Literal["beginner", "intermediate", "advanced"] | None = None
    primary_goal: Literal["everyday", "college", "workplace", "hr_interview", "technical_interview", "presentation"] | None = None
    explanation_language: Literal["english", "hinglish"] | None = None
    daily_target_minutes: int | None = Field(default=None, ge=5, le=120)
    career_target: str | None = Field(default=None, max_length=100)
    timezone: str | None = Field(default=None, max_length=64)

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str | None) -> str | None:
        if value is not None:
            try:
                ZoneInfo(value)
            except (ZoneInfoNotFoundError, ValueError) as exc:
                raise ValueError("Use a valid IANA timezone, for example Asia/Kolkata.") from exc
        return value


class RealtimeRequest(BaseModel):
    scenario: Literal["daily", "college", "friends", "self_intro", "teamwork", "workplace", "meeting", "presentation", "hr_interview", "project", "technical_interview", "group_discussion"] = "daily"
    mode: Literal["conversation", "fluency", "interview"] = "conversation"


class SessionCreate(BaseModel):
    scenario: Literal["daily", "college", "friends", "self_intro", "teamwork", "workplace", "meeting", "presentation", "hr_interview", "project", "technical_interview", "group_discussion"] = "daily"
    mode: Literal["conversation", "fluency", "interview"] = "conversation"
    transcript_consent: bool = False


class TurnInput(BaseModel):
    speaker: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class SessionComplete(BaseModel):
    turns: list[TurnInput] = Field(default_factory=list, max_length=300)

    model_config = ConfigDict(extra="forbid")


class FeedbackRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    session_id: UUID | None = None


class FeedbackItem(BaseModel):
    original: str = Field(max_length=2000)
    corrected: str = Field(max_length=2000)
    explanation: str = Field(max_length=1200)
    alternative: str = Field(max_length=2000)
    category: Literal["grammar", "tense", "agreement", "articles_prepositions", "structure", "vocabulary", "word_order", "filler", "clarity"]
    example: str = Field(max_length=2000)
    exercise: str = Field(max_length=1200)
    is_suggestion: bool


class FeedbackResponse(BaseModel):
    items: list[FeedbackItem]


class MistakeCreate(FeedbackItem):
    session_id: UUID | None = None


class MistakePatch(BaseModel):
    understood: bool


class AccountDelete(BaseModel):
    confirmation: Literal["DELETE"]


class MistakeOut(BaseModel):
    id: UUID
    session_id: UUID | None
    original: str
    corrected: str
    explanation: str
    alternative: str
    example: str
    exercise: str
    category: str
    is_suggestion: bool
    understood: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SessionOut(BaseModel):
    id: UUID
    scenario: str
    mode: str
    started_at: datetime
    ended_at: datetime | None
    duration_seconds: int
    transcript_consent: bool
    completed: bool

    model_config = ConfigDict(from_attributes=True)
