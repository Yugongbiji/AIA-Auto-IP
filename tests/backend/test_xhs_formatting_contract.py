import unittest

from backend import xhs_formatting_contract as contract


class XhsFormattingContractTest(unittest.TestCase):
    def test_three_sentence_gap_gets_one_neutral_emoji(self):
        source = "第一句。第二句。第三句。第四句。第五句。第六句。"
        result = contract._cadenced_scan_emojis(source)
        sentences = [part for part in result.split("。") if part.strip()]
        emoji = r"[\U0001F300-\U0001FAFF\u2600-\u27BF]"
        # 当前专项规则：最多连续 3 句话没有提示性表情；不要求每两句强制一个。
        for start in range(0, len(sentences), 3):
            window = "".join(sentences[start:start + 3])
            if len(sentences[start:start + 3]) == 3:
                self.assertRegex(window, emoji)
        self.assertLessEqual(len([ch for ch in result if ch in "📌💡✨✅"]), 2)

    def test_existing_emoji_resets_the_gap_counter(self):
        source = "第一句。第二句💡。第三句。第四句。第五句。"
        result = contract._cadenced_scan_emojis(source)
        self.assertIn("第二句💡", result)
        self.assertRegex(result, r"第五句。|[📌💡✨✅]\s*第五句。")

    def test_isolated_punctuation_is_joined_without_rewriting_words(self):
        source = "这是一个标题【\n重点内容\n】\n下一句。"
        result = contract._fix_isolated_punctuation(source)
        self.assertNotIn("【\n", result)
        self.assertNotIn("\n】", result)
        for word in ["这是一个标题", "重点内容", "下一句"]:
            self.assertIn(word, result)


if __name__ == "__main__":
    unittest.main()
