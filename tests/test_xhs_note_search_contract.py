import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class XiaohongshuNoteSearchContractTests(unittest.TestCase):
    def test_server_search_key_and_endpoint(self):
        server = (ROOT / "server.py").read_text(encoding="utf-8")
        frontend = (ROOT / "web" / "xhs-note-search.js").read_text(encoding="utf-8")
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        self.assertIn("/api/xhs-notes/search", server)
        self.assertIn("WELLBYTE_API_KEY", server)
        self.assertIn("https://api.wellbyte.net/v1/xiaohongshu/search/note_v4", server)
        self.assertNotIn("WELLBYTE_API_KEY", frontend)
        self.assertIn("collect_descending", html)

    def test_export_is_capped_at_50_loaded_rows(self):
        server = (ROOT / "server.py").read_text(encoding="utf-8")
        frontend = (ROOT / "web" / "xhs-note-search.js").read_text(encoding="utf-8")
        self.assertIn("len(notes) > 50", server)
        self.assertIn("sorted(allLoaded()).slice(0,50)", frontend)
        self.assertIn("/api/xhs-notes/export", frontend)

    def test_titles_open_original_note_without_preview_drawer_or_copy_id_button(self):
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        frontend = (ROOT / "web" / "xhs-note-search.js").read_text(encoding="utf-8")
        self.assertNotIn('id="xhs-note-drawer"', html)
        self.assertNotIn('id="xhs-note-copy-id"', html)
        self.assertIn("openOriginal(state.loaded.get", frontend)
        self.assertIn("/api/xhs-notes/original-link", frontend)
        self.assertIn("window.open(\"about:blank\",\"_blank\")", frontend)
        self.assertNotIn("navigator.clipboard", frontend)

    def test_preview_rewrites_double_quoted_fetch_paths(self):
        workflow = (ROOT / ".github" / "workflows" / "preview-deploy.yml").read_text(encoding="utf-8")
        self.assertIn('fetch("/api/', workflow)
        self.assertIn('fetch("/preview/api/', workflow)

    def test_search_pagination_and_local_sort_are_explicit(self):
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        frontend = (ROOT / "web" / "xhs-note-search.js").read_text(encoding="utf-8")
        self.assertIn("page:String(page)", frontend)
        self.assertIn("state.loaded.set(String(n.id),n)", frontend)
        self.assertIn("data-local-sort", html)
        self.assertIn("collect_descending", html)
        self.assertIn('"第 "+state.page+" 页 · 本页 "+state.pageNotes.length+" 条', frontend)
        self.assertIn("还有下一页", frontend)
        self.assertIn("本页 \"+state.pageNotes.length+\" 条", frontend)
        self.assertIn("累计已获取 \"+state.loaded.size+\" 条", frontend)
        self.assertIn("已到当前结果末页", frontend)

    def test_search_page_has_responsive_horizontal_gutters(self):
        css = (ROOT / "web" / "xhs-note-search.css").read_text(encoding="utf-8")
        html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
        self.assertIn("padding:22px 24px 28px", css)
        self.assertIn("padding:16px 16px 22px", css)
        self.assertIn("padding-inline:24px!important", css)
        self.assertIn("padding-inline:16px!important", css)
        self.assertIn("xhs-note-search.css?v=20261112-xhs-search-layout-3", html)

    def test_search_toolbar_uses_compact_responsive_grid(self):
        css = (ROOT / "web" / "xhs-note-search.css").read_text(encoding="utf-8")
        self.assertIn("grid-template-columns:minmax(220px,2fr) repeat(3,minmax(135px,1fr)) auto auto", css)
        self.assertIn("@media(max-width:560px)", css)
        self.assertIn("cursor:pointer", css)


if __name__ == "__main__":
    unittest.main()
