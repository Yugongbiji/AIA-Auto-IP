import unittest

from backend import xhs_formatting_contract as contract


class XhsFormattingContractTest(unittest.TestCase):
    def test_two_sentence_window_always_has_emoji(self):
        source = "第一句。第二句。第三句。第四句。"
        result = contract._strict_scan_emojis(source)
        sentences = [part for part in result.split("。") if part.strip()]
        for index in range(1, len(sentences)):
            pair = sentences[index - 1] + sentences[index]
            self.assertRegex(pair, r"[\U0001F300-\U0001FAFF\u2600-\u27BF]")

    def test_existing_emoji_resets_the_two_sentence_counter(self):
        source = "第一句。第二句💡。第三句。第四句。"
        result = contract._strict_scan_emojis(source)
        self.assertIn("第二句💡", result)
        self.assertRegex(result, r"[📌💡✨✅]\s*第四句。")

    def test_isolated_punctuation_is_joined_without_rewriting_words(self):
        source = "这是一个标题【\n重点内容\n】\n下一句。"
        result = contract._fix_isolated_punctuation(source)
        self.assertNotIn("【\n", result)
        self.assertNotIn("\n】", result)
        for word in ["这是一个标题", "重点内容", "下一句"]:
            self.assertIn(word, result)


if __name__ == "__main__":
    unittest.main()
