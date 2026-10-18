import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    display_name: Mapped[str] = mapped_column(String(100), default="")
    english_level: Mapped[str] = mapped_column(String(20), default="beginner")
    primary_goal: Mapped[str] = mapped_column(String(40), default="everyday")
    explanation_language: Mapped[str] = mapped_column(String(20), default="english")
    daily_target_minutes: Mapped[int] = mapped_column(Integer, default=10)
    career_target: Mapped[str] = mapped_column(String(100), default="")
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PracticeSession(Base):
    __tablename__ = "practice_sessions"
    __table_args__ = (Index("ix_practice_sessions_user_started", "user_id", "started_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    scenario: Mapped[str] = mapped_column(String(40), default="daily")
    mode: Mapped[str] = mapped_column(String(20), default="conversation")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    transcript_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    turns: Mapped[list["ConversationTurn"]] = relationship(cascade="all, delete-orphan")


class ConversationTurn(Base):
    __tablename__ = "conversation_turns"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("practice_sessions.id", ondelete="CASCADE"), index=True)
    speaker: Mapped[str] = mapped_column(String(12))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Mistake(Base):
    __tablename__ = "mistakes"
    __table_args__ = (Index("ix_mistakes_user_review", "user_id", "understood"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    session_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("practice_sessions.id", ondelete="SET NULL"), nullable=True)
    original: Mapped[str] = mapped_column(Text)
    corrected: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str] = mapped_column(Text)
    alternative: Mapped[str] = mapped_column(Text, default="")
    example: Mapped[str] = mapped_column(Text, default="")
    exercise: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(40))
    is_suggestion: Mapped[bool] = mapped_column(Boolean, default=False)
    understood: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DailyGoal(Base):
    __tablename__ = "daily_goals"
    __table_args__ = (
        UniqueConstraint("user_id", "day", name="uq_daily_goals_user_day"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    day: Mapped[date] = mapped_column(Date)
    target_minutes: Mapped[int] = mapped_column(Integer)
    completed_minutes: Mapped[int] = mapped_column(Integer, default=0)
