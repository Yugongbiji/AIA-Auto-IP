import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
class XiaohongshuNoteSearchContractTests(unittest.TestCase):
    def test_server_search_key_and_endpoint(self):
        server=(ROOT/"server.py").read_text(encoding="utf-8")
        frontend=(ROOT/"web"/"xhs-note-search.js").read_text(encoding="utf-8")
        self.assertIn("/api/xhs-notes/search",server)
        self.assertIn("WELLBYTE_API_KEY",server)
        self.assertIn("https://api.wellbyte.net/v1/xiaohongshu/search/note_v4",server)
        self.assertNotIn("WELLBYTE_API_KEY",frontend)
        self.assertIn("collect_descending",html)
    def test_export_is_capped_at_50_loaded_rows(self):
        server=(ROOT/"server.py").read_text(encoding="utf-8")
        frontend=(ROOT/"web"/"xhs-note-search.js").read_text(encoding="utf-8")
        self.assertIn("len(notes) > 50",server)
        self.assertIn("sorted(allLoaded()).slice(0,50)",frontend)
        self.assertIn("/api/xhs-notes/export",frontend)
    def test_drawer_and_original_note_link(self):
        html=(ROOT/"web"/"index.html").read_text(encoding="utf-8")
        frontend=(ROOT/"web"/"xhs-note-search.js").read_text(encoding="utf-8")
        self.assertIn('id="xhs-note-drawer"',html)
        self.assertIn('id="xhs-note-open-original"',html)
        self.assertIn("www.xiaohongshu.com/explore/",frontend)
    def test_search_pagination_and_local_sort(self):
        html=(ROOT/"web"/"index.html").read_text(encoding="utf-8")
        frontend=(ROOT/"web"/"xhs-note-search.js").read_text(encoding="utf-8")
        self.assertIn("page:String(page)",frontend)
        self.assertIn("state.loaded.set(String(n.id),n)",frontend)
        self.assertIn("data-local-sort",html)
        self.assertIn("collect_descending",html)
if __name__=="__main__": unittest.main()
