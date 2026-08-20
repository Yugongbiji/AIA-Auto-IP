import unittest

from backend.script_recommendation import allocate_recommendations, load_mapping, score_script_for_direction


class ScriptRecommendationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mapping = load_mapping()

    def test_alias_matches_canonical_direction(self):
        script = {"level1_tag": "养老", "level2_tag": "规划", "is_hot": False}
        match = score_script_for_direction(script, "养老", self.mapping)
        self.assertEqual(match.direction, "养老规划")
        self.assertGreater(match.score, 0)

    def test_unrelated_script_does_not_match(self):
        script = {"level1_tag": "教育", "level2_tag": "育儿", "is_hot": False}
        match = score_script_for_direction(script, "养老规划", self.mapping)
        self.assertEqual(match.score, 0)

    def test_hotspot_cannot_create_unrelated_match(self):
        script = {"level1_tag": "热点", "level2_tag": "节日节点", "is_hot": True}
        match = score_script_for_direction(script, "养老规划", self.mapping)
        self.assertEqual(match.score, 0)

    def test_same_script_only_appears_once_in_batch(self):
        scripts = [
            {"script_id": 1, "level1_tag": "健康", "level2_tag": "重疾险", "is_hot": False, "status": "active"},
            {"script_id": 2, "level1_tag": "养老", "level2_tag": "规划", "is_hot": False, "status": "active"},
        ]
        result = allocate_recommendations(scripts, ["家庭保障方案", "医疗保障", "养老规划"], self.mapping)
        ids = [script["script_id"] for group in result for script in group["scripts"]]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertIn(1, ids)
        self.assertIn(2, ids)

    def test_limit_is_per_direction(self):
        scripts = [
            {"script_id": i, "level1_tag": "教育", "level2_tag": "育儿", "is_hot": False, "status": "active"}
            for i in range(1, 10)
        ]
        result = allocate_recommendations(scripts, ["育儿"], self.mapping, limit_per_direction=5)
        self.assertEqual(len(result[0]["scripts"]), 5)


if __name__ == "__main__":
    unittest.main()
