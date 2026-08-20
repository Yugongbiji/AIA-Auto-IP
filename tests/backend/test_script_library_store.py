import sqlite3
from pathlib import Path

import script_library_store as store


class DbFactory:
    def __init__(self, path: Path):
        self.path = path

    def __call__(self):
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn


def seed_script(database):
    with database() as conn:
        conn.execute(
            """
            INSERT INTO script_library(
                batch, level1_tag, level2_tag, title_1, title_2, title_3,
                body, word_count, estimated_minutes, is_hot, reviewed_at,
                status, content_hash, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "第一批", "养老", "政策", "养老政策怎么变", None, None,
                "这是一段测试正文。", 8, 0.1, 1, "2026-08-01",
                "active", "hash-1", "2026-08-20T00:00:00+00:00", "2026-08-20T00:00:00+00:00",
            ),
        )
        return conn.execute("SELECT script_id FROM script_library WHERE content_hash = ?", ("hash-1",)).fetchone()[0]


def test_initialize_and_read_script(tmp_path):
    database = DbFactory(tmp_path / "script.sqlite3")
    store.initialize_script_library(database, lambda: "sqlite")
    script_id = seed_script(database)

    scripts = store.list_active_scripts(database)
    assert len(scripts) == 1
    assert scripts[0]["script_id"] == script_id
    assert scripts[0]["is_hot"] is True

    detail = store.get_script(database, script_id)
    assert detail["title_1"] == "养老政策怎么变"
    assert detail["level2_tag"] == "政策"


def test_inactive_script_not_exposed(tmp_path):
    database = DbFactory(tmp_path / "script.sqlite3")
    store.initialize_script_library(database, lambda: "sqlite")
    script_id = seed_script(database)
    with database() as conn:
        conn.execute("UPDATE script_library SET status = 'inactive' WHERE script_id = ?", (script_id,))

    assert store.list_active_scripts(database) == []
    assert store.get_script(database, script_id) is None


def test_activity_funnel_is_recorded(tmp_path):
    database = DbFactory(tmp_path / "script.sqlite3")
    store.initialize_script_library(database, lambda: "sqlite")
    script_id = seed_script(database)

    assert store.record_script_activity(
        database,
        script_id=script_id,
        event_type="impression",
        agent_id="123456789",
        content_direction="养老规划",
        recommendation_batch="batch-001",
    ) is True
    assert store.record_script_activity(
        database,
        script_id=script_id,
        event_type="detail_click",
        agent_id="123456789",
        content_direction="养老规划",
        recommendation_batch="batch-001",
    ) is True

    summary = store.script_activity_summary(database, script_id)
    assert summary["impression"] == 1
    assert summary["detail_click"] == 1
    assert summary["rewrite_click"] == 0
    assert summary["xhs_click"] == 0


def test_invalid_activity_event_rejected(tmp_path):
    database = DbFactory(tmp_path / "script.sqlite3")
    store.initialize_script_library(database, lambda: "sqlite")
    script_id = seed_script(database)

    try:
        store.record_script_activity(database, script_id=script_id, event_type="unknown")
    except ValueError as error:
        assert "Invalid script activity event" in str(error)
    else:
        raise AssertionError("invalid event should be rejected")
