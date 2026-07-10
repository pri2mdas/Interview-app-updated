"""
PostgreSQL database layer for the Take My Interview platform.

Stores registered users + their interview sessions. Uses a thread-safe
psycopg2 connection pool and RealDictCursor so rows behave dict-like —
preserving the previous sqlite3.Row API used by auth.py / server.py.

Connection is configured via the DATABASE_URL environment variable, e.g.
    DATABASE_URL=[REDACTED-DATABASE_CONNECTION_STRING]
"""
from __future__ import annotations

import json
import logging
import os
import threading
from contextlib import contextmanager
from typing import Iterator, Optional

import psycopg2
import psycopg2.extras
import psycopg2.pool
from psycopg2.extras import RealDictCursor

# Auto-serialise Python dicts/lists to JSONB on INSERT/UPDATE, and auto-parse
# JSONB back to Python objects on SELECT. Global registration is fine — every
# connection in the pool inherits it.
psycopg2.extras.register_default_jsonb(globally=True)

logger = logging.getLogger(__name__)

# ── Connection pool ──────────────────────────────────────────────────────────
# Created lazily on first use so importing this module never fails (important
# for tooling that imports server.py without a live DB, e.g. CI lint).
_pool: Optional[psycopg2.pool.ThreadedConnectionPool] = None
_pool_lock = threading.Lock()

# Sensible local-dev default if DATABASE_URL is not set. In production this
# MUST be supplied via env / k8s Secret.
DEFAULT_DATABASE_URL = "[REDACTED-DATABASE_CONNECTION_STRING]"


def _build_pool() -> psycopg2.pool.ThreadedConnectionPool:
    """Create the global connection pool. Thread-safe."""
    dsn = os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)
    # minconn=1, maxconn=10 is plenty for a single FastAPI worker; bump
    # maxconn if you scale uvicorn --workers or add async traffic.
    pool = psycopg2.pool.ThreadedConnectionPool(
        minconn=1,
        maxconn=int(os.environ.get("DB_POOL_MAX", "10")),
        dsn=dsn,
        connect_timeout=5,
    )
    logger.info("Postgres connection pool initialised (dsn host=%s)", _safe_dsn_host(dsn))
    return pool


def _safe_dsn_host(dsn: str) -> str:
    """Return just the host portion of a DSN — never log credentials."""
    try:
        # psycopg2 parse_dsn returns a dict; we only want the host.
        return psycopg2.extensions.parse_dsn(dsn).get("host", "?")
    except Exception:
        return "?"


def get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = _build_pool()
    return _pool


def close_pool() -> None:
    """Close all pooled connections. Call on app shutdown if you wire it in."""
    global _pool
    with _pool_lock:
        if _pool is not None:
            _pool.closeall()
            _pool = None


# ── Cursor context manager ───────────────────────────────────────────────────
@contextmanager
def cursor() -> Iterator[psycopg2.extras.RealDictCursor]:
    """
    Hand out a DictCursor bound to a pooled connection. Commits on success,
    rolls back on exception, and always releases the connection back to the
    pool — even on errors.
    """
    pool = get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            logger.exception("Rollback failed")
        raise
    finally:
        pool.putconn(conn)


# ── Schema ───────────────────────────────────────────────────────────────────
SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    username      TEXT NOT NULL UNIQUE,
    full_name     TEXT,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS interviews (
    id               BIGSERIAL PRIMARY KEY,
    session_id       TEXT NOT NULL UNIQUE,
    user_id          BIGINT,
    candidate_name   TEXT NOT NULL,
    topics           TEXT NOT NULL,
    difficulty       TEXT NOT NULL,
    mode             TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    started_at       TEXT NOT NULL,
    ended_at         TEXT,
    status           TEXT NOT NULL DEFAULT 'active',
    final_report     TEXT,
    -- Live interview state. messages holds the full transcript as a JSON
    -- array of {role, content, score, ...} dicts; scores is a parallel JSON
    -- array of integers (kept separate so we can index/aggregate it without
    -- touching the message bodies). system_prompt is the Gemini prompt we
    -- rebuild for every turn — cached here so any backend replica can resume
    -- a session that was started on a different pod.
    messages         JSONB        NOT NULL DEFAULT '[]'::jsonb,
    scores           JSONB        NOT NULL DEFAULT '[]'::jsonb,
    system_prompt    TEXT,
    CONSTRAINT interviews_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_interviews_user_id    ON interviews(user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_started_at ON interviews(started_at DESC);
"""

# Backfill: the user_id column was added after the table was first shipped,
# and messages/scores/system_prompt were added when live state moved out of
# the in-memory dict. This block is idempotent — it does nothing on fresh
# installs and adds the missing pieces on legacy installs.
BACKFILL_SQL = """
DO $$
BEGIN
    -- user_id (original backfill, kept for older installs)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'interviews' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE interviews
            ADD COLUMN user_id BIGINT,
            ADD CONSTRAINT interviews_user_id_fkey
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_interviews_user_id ON interviews(user_id);
    END IF;

    -- Live state columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'interviews' AND column_name = 'messages'
    ) THEN
        ALTER TABLE interviews
            ADD COLUMN messages JSONB NOT NULL DEFAULT '[]'::jsonb;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'interviews' AND column_name = 'scores'
    ) THEN
        ALTER TABLE interviews
            ADD COLUMN scores JSONB NOT NULL DEFAULT '[]'::jsonb;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'interviews' AND column_name = 'system_prompt'
    ) THEN
        ALTER TABLE interviews
            ADD COLUMN system_prompt TEXT;
    END IF;
END
$$;
"""


def init_db() -> None:
    """Create tables if they don't exist. Safe to call repeatedly."""
    with cursor() as c:
        c.execute(SCHEMA_SQL)
        c.execute(BACKFILL_SQL)


# ── User helpers ─────────────────────────────────────────────────────────────
def get_user_by_email(email: str) -> Optional[psycopg2.extras.RealDictRow]:
    with cursor() as c:
        c.execute("SELECT * FROM users WHERE email = %s", (email.lower(),))
        return c.fetchone()


def get_user_by_username(username: str) -> Optional[psycopg2.extras.RealDictRow]:
    with cursor() as c:
        c.execute("SELECT * FROM users WHERE username = %s", (username,))
        return c.fetchone()


def get_user_by_id(user_id: int) -> Optional[psycopg2.extras.RealDictRow]:
    with cursor() as c:
        c.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        return c.fetchone()


def create_user(
    email: str,
    username: str,
    password_hash: str,
    full_name: str,
    created_at: str,
) -> int:
    with cursor() as c:
        c.execute(
            "INSERT INTO users (email, username, full_name, password_hash, created_at) "
            "VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (email.lower(), username, full_name, password_hash, created_at),
        )
        row = c.fetchone()
        return int(row["id"])


# ── Interview helpers ────────────────────────────────────────────────────────
# The `interviews` table is the single source of truth for both the persisted
# metadata (candidate_name, topics, …) AND the live state (messages, scores,
# system_prompt). This is what lets a session started on backend pod A be
# resumed on backend pod B without any external cache.
def create_interview(
    *,
    session_id: str,
    user_id: Optional[int],
    candidate_name: str,
    topics: str,                # comma-joined, matches the column shape
    difficulty: str,
    mode: str,
    duration_minutes: int,
    started_at: str,
    messages: list,
    scores: list,
    system_prompt: str,
) -> None:
    """Insert a brand-new interview row with its initial state."""
    with cursor() as c:
        c.execute(
            "INSERT INTO interviews ("
            " session_id, user_id, candidate_name, topics, difficulty, mode,"
            " duration_minutes, started_at, status, messages, scores, system_prompt"
            ") VALUES ("
            " %s, %s, %s, %s, %s, %s, %s, %s, 'active', %s, %s, %s"
            ")",
            (
                session_id,
                user_id,
                candidate_name,
                topics,
                difficulty,
                mode,
                duration_minutes,
                started_at,
                json.dumps(messages),  # explicit JSON serialisation for JSONB
                json.dumps(scores),    # explicit JSON serialisation for JSONB
                system_prompt,
            ),
        )


def get_interview(session_id: str) -> Optional[dict]:
    """Return the full interview row (including live state) or None."""
    with cursor() as c:
        c.execute("SELECT * FROM interviews WHERE session_id = %s", (session_id,))
        row = c.fetchone()
        return dict(row) if row else None


def update_interview_messages(session_id: str, messages: list, scores: list) -> None:
    """Persist the live transcript + score list after a Q/A turn."""
    with cursor() as c:
        c.execute(
            "UPDATE interviews SET messages = %s, scores = %s WHERE session_id = %s",
            (json.dumps(messages), json.dumps(scores), session_id),
        )


def update_interview_completion(
    session_id: str,
    ended_at: str,
    final_report: dict,
) -> None:
    """Mark the interview completed and store the generated report."""
    with cursor() as c:
        c.execute(
            "UPDATE interviews "
            "SET status = 'completed', ended_at = %s, final_report = %s "
            "WHERE session_id = %s",
            (ended_at, json.dumps(final_report), session_id),
        )
