import sqlite3
import tempfile
import unittest
from pathlib import Path

from backend import script_api
import script_library_store as store


class DbFactory:
    def __init__(self, path: Path):
        self.path = path

    def __call__(self):
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn


def add_script(database, *, level1, level2, title, body, content_hash, is_hot=0):
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
                "第一批", level1, level2, title, None, None,
                body, 520, 2.0, is_hot, "2026-08-01", "active", content_hash,
                "2026-08-20T00:00:00+00:00", "2026-08-20T00:00:00+00:00",
            ),
        )
        return conn.execute("SELECT script_id FROM script_library WHERE content_hash = ?", (content_hash,)).fetchone()[0]


class ScriptApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database = DbFactory(Path(self.temp_dir.name) / "api.sqlite3")
        store.initialize_script_library(self.database, lambda: "sqlite")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_recommend_returns_card_shape_and_cross_direction_dedupe(self):
        first = add_script(self.database, level1="健康", level2="重疾险", title="重疾险脚本", body="正文A", content_hash="a", is_hot=1)
        second = add_script(self.database, level1="养老", level2="规划", title="养老脚本", body="正文B", content_hash="b")
        result = script_api.recommend(self.database, {"contentDirections": ["家庭保障方案", "保险科普", "养老规划"]})
        ids = [item["script_id"] for group in result["groups"] for item in group["scripts"]]
        self.assertEqual(ids.count(first), 1)
        self.assertEqual(ids.count(second), 1)
        self.assertTrue(result["recommendation_batch"].startswith("rec-"))
        card = next(item for group in result["groups"] for item in group["scripts"] if item["script_id"] == first)
        self.assertEqual(card["title"], "重疾险脚本")
        self.assertEqual(card["estimated_minutes"], 2.0)
        self.assertTrue(card["is_hot"])
        self.assertNotIn("body", card)

    def test_detail_contains_body_and_three_title_fields(self):
        script_id = add_script(self.database, level1="养老", level2="政策", title="首标题", body="完整正文", content_hash="detail")
        detail = script_api.detail(self.database, script_id)
        self.assertEqual(detail["title_1"], "首标题")
        self.assertEqual(detail["body"], "完整正文")
        self.assertIn("title_2", detail)
        self.assertIn("title_3", detail)

    def test_activity_records_recommendation_funnel(self):
        script_id = add_script(self.database, level1="养老", level2="政策", title="养老", body="正文", content_hash="activity")
        result = script_api.activity(self.database, {
            "scriptId": script_id,
            "eventType": "rewrite_click",
            "agentId": "123456789",
            "contentDirection": "养老规划",
            "recommendationBatch": "rec-test",
        })
        self.assertEqual(result, {"ok": True})
        self.assertEqual(store.script_activity_summary(self.database, script_id)["rewrite_click"], 1)

    def test_invalid_direction_payload_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "contentDirections"):
            script_api.recommend(self.database, {"contentDirections": "养老规划"})


if __name__ == "__main__":
    unittest.main()
