"""Create initial user practice tables.

Revision ID: 0001_initial
Revises:
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "user_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("display_name", sa.String(100), nullable=False, server_default=""),
        sa.Column("english_level", sa.String(20), nullable=False, server_default="beginner"),
        sa.Column("primary_goal", sa.String(40), nullable=False, server_default="everyday"),
        sa.Column("explanation_language", sa.String(20), nullable=False, server_default="english"),
        sa.Column("daily_target_minutes", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("career_target", sa.String(100), nullable=False, server_default=""),
        sa.Column("timezone", sa.String(64), nullable=False, server_default="UTC"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "practice_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("scenario", sa.String(40), nullable=False, server_default="daily"),
        sa.Column("mode", sa.String(20), nullable=False, server_default="conversation"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("transcript_consent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_practice_sessions_user_started", "practice_sessions", ["user_id", "started_at"])
    op.create_table(
        "conversation_turns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("practice_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("speaker", sa.String(12), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_conversation_turns_session_id", "conversation_turns", ["session_id"])
    op.create_table(
        "mistakes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("practice_sessions.id", ondelete="SET NULL")),
        sa.Column("original", sa.Text(), nullable=False),
        sa.Column("corrected", sa.Text(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("alternative", sa.Text(), nullable=False, server_default=""),
        sa.Column("example", sa.Text(), nullable=False, server_default=""),
        sa.Column("exercise", sa.Text(), nullable=False, server_default=""),
        sa.Column("category", sa.String(40), nullable=False),
        sa.Column("is_suggestion", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("understood", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_mistakes_user_review", "mistakes", ["user_id", "understood"])
    op.create_table(
        "daily_goals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("target_minutes", sa.Integer(), nullable=False),
        sa.Column("completed_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("user_id", "day", name="uq_daily_goals_user_day"),
    )


def downgrade():
    op.drop_table("daily_goals")
    op.drop_table("mistakes")
    op.drop_table("conversation_turns")
    op.drop_index("ix_practice_sessions_user_started", table_name="practice_sessions")
    op.drop_table("practice_sessions")
    op.drop_table("user_profiles")
