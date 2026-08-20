import sqlite3
import tempfile
import unittest
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


class ScriptLibraryStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database = DbFactory(Path(self.temp_dir.name) / "script.sqlite3")
        store.initialize_script_library(self.database, lambda: "sqlite")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_initialize_and_read_script(self):
        script_id = seed_script(self.database)
        scripts = store.list_active_scripts(self.database)
        self.assertEqual(len(scripts), 1)
        self.assertEqual(scripts[0]["script_id"], script_id)
        self.assertTrue(scripts[0]["is_hot"])
        detail = store.get_script(self.database, script_id)
        self.assertEqual(detail["title_1"], "养老政策怎么变")
        self.assertEqual(detail["level2_tag"], "政策")

    def test_inactive_script_not_exposed(self):
        script_id = seed_script(self.database)
        with self.database() as conn:
            conn.execute("UPDATE script_library SET status = 'inactive' WHERE script_id = ?", (script_id,))
        self.assertEqual(store.list_active_scripts(self.database), [])
        self.assertIsNone(store.get_script(self.database, script_id))

    def test_activity_funnel_is_recorded(self):
        script_id = seed_script(self.database)
        self.assertTrue(store.record_script_activity(
            self.database, script_id=script_id, event_type="impression",
            agent_id="123456789", content_direction="养老规划",
            recommendation_batch="batch-001",
        ))
        self.assertTrue(store.record_script_activity(
            self.database, script_id=script_id, event_type="detail_click",
            agent_id="123456789", content_direction="养老规划",
            recommendation_batch="batch-001",
        ))
        summary = store.script_activity_summary(self.database, script_id)
        self.assertEqual(summary["impression"], 1)
        self.assertEqual(summary["detail_click"], 1)
        self.assertEqual(summary["rewrite_click"], 0)
        self.assertEqual(summary["xhs_click"], 0)

    def test_invalid_activity_event_rejected(self):
        script_id = seed_script(self.database)
        with self.assertRaisesRegex(ValueError, "Invalid script activity event"):
            store.record_script_activity(self.database, script_id=script_id, event_type="unknown")


if __name__ == "__main__":
    unittest.main()
