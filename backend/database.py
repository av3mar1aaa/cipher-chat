"""
CipherChat — Database models and initialization.
Uses SQLAlchemy Core for table definitions and the `databases` async library for queries.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

import sqlalchemy
from databases import Database
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./cipher_chat.db")

# ---------------------------------------------------------------------------
# Async database instance (used for queries throughout the app)
# ---------------------------------------------------------------------------
database = Database(DATABASE_URL)

# ---------------------------------------------------------------------------
# SQLAlchemy metadata & table definitions
# ---------------------------------------------------------------------------
metadata = sqlalchemy.MetaData()

users = sqlalchemy.Table(
    "users",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, autoincrement=True),
    sqlalchemy.Column("username", sqlalchemy.String(64), unique=True, nullable=False, index=True),
    sqlalchemy.Column("password_hash", sqlalchemy.String(256), nullable=False),
    sqlalchemy.Column("display_name", sqlalchemy.String(128), nullable=False),
    sqlalchemy.Column("avatar_url", sqlalchemy.String(512), nullable=True),
    sqlalchemy.Column(
        "last_seen",
        sqlalchemy.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    ),
    sqlalchemy.Column(
        "created_at",
        sqlalchemy.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    ),
)

chats = sqlalchemy.Table(
    "chats",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, autoincrement=True),
    sqlalchemy.Column("name", sqlalchemy.String(256), nullable=True),
    sqlalchemy.Column(
        "type",
        sqlalchemy.String(16),
        nullable=False,
        default="private",
    ),
    sqlalchemy.Column("avatar_url", sqlalchemy.String(512), nullable=True),
    sqlalchemy.Column(
        "created_at",
        sqlalchemy.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    ),
)

chat_members = sqlalchemy.Table(
    "chat_members",
    metadata,
    sqlalchemy.Column(
        "chat_id",
        sqlalchemy.Integer,
        sqlalchemy.ForeignKey("chats.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    sqlalchemy.Column(
        "user_id",
        sqlalchemy.Integer,
        sqlalchemy.ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    sqlalchemy.Column("role", sqlalchemy.String(16), nullable=False, default="member"),
    sqlalchemy.Column(
        "joined_at",
        sqlalchemy.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    ),
)

messages = sqlalchemy.Table(
    "messages",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True, autoincrement=True),
    sqlalchemy.Column(
        "chat_id",
        sqlalchemy.Integer,
        sqlalchemy.ForeignKey("chats.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    sqlalchemy.Column(
        "sender_id",
        sqlalchemy.Integer,
        sqlalchemy.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    ),
    sqlalchemy.Column("content", sqlalchemy.Text, nullable=True),
    sqlalchemy.Column("type", sqlalchemy.String(16), nullable=False, default="text"),
    sqlalchemy.Column("file_url", sqlalchemy.String(512), nullable=True),
    sqlalchemy.Column("is_read", sqlalchemy.Boolean, nullable=False, default=False),
    sqlalchemy.Column(
        "created_at",
        sqlalchemy.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    ),
    sqlalchemy.Column("edited_at", sqlalchemy.DateTime, nullable=True),
    sqlalchemy.Column("deleted", sqlalchemy.Boolean, nullable=False, default=False),
)

# ---------------------------------------------------------------------------
# Composite indexes for query performance
# ---------------------------------------------------------------------------
from sqlalchemy import Index

Index('idx_messages_chat_created', messages.c.chat_id, messages.c.created_at)
Index('idx_messages_unread', messages.c.chat_id, messages.c.sender_id, messages.c.is_read)
Index('idx_chat_members_user', chat_members.c.user_id, chat_members.c.chat_id)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def init_db() -> None:
    """Create all tables if they do not exist (uses a sync engine under the hood)."""
    sync_url = DATABASE_URL.replace("+aiosqlite", "")
    engine = sqlalchemy.create_engine(sync_url, connect_args={"check_same_thread": False})
    metadata.create_all(engine)
    engine.dispose()
