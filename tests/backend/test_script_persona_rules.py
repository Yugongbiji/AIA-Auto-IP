import unittest
from backend import script_persona_rules


class ScriptPersonaRulesTest(unittest.TestCase):
    def test_account_tone_becomes_explicit_instruction(self):
        prepared, tone = script_persona_rules.prepare_profile({"contentTone": "专业理性｜自然真实"})
        self.assertEqual(tone, "专业理性｜自然真实")
        self.assertIn("账号表达风格已确认", prepared["scriptStyleInstruction"])
        self.assertIn("专业理性｜自然真实", prepared["scriptStyleInstruction"])

    def test_breakdown_always_reports_confirmed_tone(self):
        result = {"breakdown": {"ipUse": "结合了真实职业经历。"}}
        enriched = script_persona_rules.enrich_breakdown(result, "亲和温暖")
        self.assertIn("亲和温暖", enriched["breakdown"]["ipUse"])
        self.assertIn("真实职业经历", enriched["breakdown"]["ipUse"])


if __name__ == "__main__":
    unittest.main()
