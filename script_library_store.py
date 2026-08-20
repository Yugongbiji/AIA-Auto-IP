"""Shared data layer for Script Recommendation V1.

The functions accept the app's `database` callable and `database_engine`
callable so they work with both Preview SQLite and production PostgreSQL
without duplicating SQL in the HTTP layer.
"""
from __future__ import annotations

from datetime import datetime, timezone

VALID_ACTIVITY_EVENTS = {"impression", "detail_click", "rewrite_click", "xhs_click"}


def initialize_script_library(database, database_engine):
    """Create script library and activity tables idempotently."""
    id_column = "INTEGER PRIMARY KEY AUTOINCREMENT" if database_engine() == "sqlite" else "BIGSERIAL PRIMARY KEY"
    bool_type = "INTEGER" if database_engine() == "sqlite" else "BOOLEAN"
    with database() as conn:
        conn.executescript(
            f"""
            CREATE TABLE IF NOT EXISTS script_library (
                script_id {id_column},
                batch TEXT,
                level1_tag TEXT NOT NULL,
                level2_tag TEXT,
                title_1 TEXT NOT NULL,
                title_2 TEXT,
                title_3 TEXT,
                body TEXT NOT NULL,
                word_count INTEGER NOT NULL,
                estimated_minutes REAL NOT NULL,
                is_hot {bool_type} NOT NULL DEFAULT 0,
                reviewed_at TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                content_hash TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_script_library_tags
                ON script_library(level1_tag, level2_tag);
            CREATE INDEX IF NOT EXISTS idx_script_library_active
                ON script_library(status, is_hot, script_id);

            CREATE TABLE IF NOT EXISTS script_user_activity (
                id {id_column},
                agent_id TEXT,
                script_id INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                content_direction TEXT,
                recommendation_batch TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(script_id) REFERENCES script_library(script_id)
            );
            CREATE INDEX IF NOT EXISTS idx_script_user_activity_script
                ON script_user_activity(script_id, event_type, created_at);
            CREATE INDEX IF NOT EXISTS idx_script_user_activity_agent
                ON script_user_activity(agent_id, created_at);
            """
        )


def _row_dict(row):
    return dict(row) if row is not None else None


def list_active_scripts(database):
    """Return all active scripts in a stable shape for the recommendation engine."""
    with database() as conn:
        rows = conn.execute(
            """
            SELECT script_id, batch, level1_tag, level2_tag,
                   title_1, title_2, title_3, body,
                   word_count, estimated_minutes, is_hot,
                   reviewed_at, status
            FROM script_library
            WHERE status = 'active'
            ORDER BY script_id ASC
            """
        ).fetchall()
    result = []
    for row in rows:
        item = dict(row)
        item["is_hot"] = bool(item.get("is_hot"))
        result.append(item)
    return result


def get_script(database, script_id: int):
    """Fetch one active script for the detail page."""
    with database() as conn:
        row = conn.execute(
            """
            SELECT script_id, batch, level1_tag, level2_tag,
                   title_1, title_2, title_3, body,
                   word_count, estimated_minutes, is_hot,
                   reviewed_at, status
            FROM script_library
            WHERE script_id = ? AND status = 'active'
            """,
            (script_id,),
        ).fetchone()
    item = _row_dict(row)
    if item:
        item["is_hot"] = bool(item.get("is_hot"))
    return item


def record_script_activity(
    database,
    *,
    script_id: int,
    event_type: str,
    agent_id: str | None = None,
    content_direction: str | None = None,
    recommendation_batch: str | None = None,
):
    """Persist one recommendation funnel event.

    `agent_id` is optional so guest/Preview flows can still be measured without
    inventing a user identity.
    """
    if event_type not in VALID_ACTIVITY_EVENTS:
        raise ValueError("Invalid script activity event")
    now = datetime.now(timezone.utc).isoformat()
    with database() as conn:
        exists = conn.execute(
            "SELECT 1 FROM script_library WHERE script_id = ? AND status = 'active'",
            (script_id,),
        ).fetchone()
        if not exists:
            return False
        conn.execute(
            """
            INSERT INTO script_user_activity(
                agent_id, script_id, event_type, content_direction,
                recommendation_batch, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                agent_id or None,
                script_id,
                event_type,
                content_direction or None,
                recommendation_batch or None,
                now,
            ),
        )
    return True


def script_activity_summary(database, script_id: int):
    """Small aggregate used later by ranking/admin analytics."""
    with database() as conn:
        rows = conn.execute(
            """
            SELECT event_type, COUNT(*) AS count
            FROM script_user_activity
            WHERE script_id = ?
            GROUP BY event_type
            """,
            (script_id,),
        ).fetchall()
    counts = {event: 0 for event in VALID_ACTIVITY_EVENTS}
    for row in rows:
        counts[row["event_type"]] = row["count"]
    return counts
