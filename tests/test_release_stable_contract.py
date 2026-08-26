import json
import re
import sqlite3
from pathlib import Path
from types import SimpleNamespace

from backend import stable_runtime
from backend.stable_ip import ensure_stable_schema, promote_output


ROOT = Path(__file__).resolve().parents[1]


def sample_output():
    return {
        "nickname": "稳定昵称",
        "whoLines": ["🎓 北大毕业｜近10年总部内勤"],
        "advantageLines": ["🏆 半年晋升A1｜一年晋升A2"],
        "valueLines": ["💡 线上获客经验｜个人账号经营方法"],
        "headline": "✨ 北大毕业，近10年总部经验，把线上经营做成长期能力",
        "xiaohongshuBio": [
            "🎓 北大毕业｜近10年总部内勤",
            "🏆 半年晋升A1｜一年晋升A2",
            "💡 线上获客经验｜个人账号经营方法",
            "✨ 北大毕业，近10年总部经验，把线上经营做成长期能力",
            "本账号所述内容为个人意见，不代表任何官方意见。",
        ],
        "videoDouyinBio": [
            "🎓 北大毕业｜近10年保险总部内勤",
            "🏆 半年晋升A1｜一年晋升A2",
            "💡 线上获客经验｜个人账号经营方法",
            "✨ 北大毕业，近10年总部经验，把线上经营做成长期能力",
            "本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见",
            "营销服务部：测试",
            "执业证编号：TEST",
        ],
    }


def make_db():
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.execute("CREATE TABLE agents(agent_id TEXT PRIMARY KEY, name TEXT, survey_json TEXT, imported_at TEXT)")
    db.execute("CREATE TABLE proposals(id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id TEXT, version INTEGER, proposal_json TEXT, model TEXT, created_at TEXT, UNIQUE(agent_id, version))")
    db.execute("INSERT INTO agents VALUES ('1','测试','{}','now')")
    ensure_stable_schema(db)
    promote_output(db, "1", sample_output(), "human_approved_baseline_20260826", approved=True)
    return db


def test_lookup_history_prefers_current_ip_outputs():
    db = make_db()
    legacy = {"version": 99, "proposal": {"headline": "旧 fallback"}, "model": "deepseek", "createdAt": "old"}
    core = SimpleNamespace(
        database=lambda: db,
        proposal_history=lambda agent_id: [legacy],
        deepseek_generate=lambda profile: (_ for _ in ()).throw(AssertionError("DeepSeek must not run for stable agent")),
        save_proposal=lambda *args: (_ for _ in ()).throw(AssertionError("stable output must not create a new proposal")),
    )
    stable_runtime.install(core)
    history = core.proposal_history("1")
    assert history[0]["proposal"]["headline"] == sample_output()["headline"]
    assert history[0]["proposal"]["_stableMeta"]["approved"] is True
    assert history[1]["proposal"]["headline"] == "旧 fallback"


def test_generate_returns_stable_without_deepseek_or_duplicate_save():
    db = make_db()
    calls = {"deepseek": 0, "save": 0}

    def deepseek(profile):
        calls["deepseek"] += 1
        return {"proposal": {"headline": "不应出现"}, "model": "deepseek", "usage": {}}

    def save(*args):
        calls["save"] += 1
        return 99

    core = SimpleNamespace(database=lambda: db, proposal_history=lambda agent_id: [], deepseek_generate=deepseek, save_proposal=save)
    stable_runtime.install(core)
    generated = core.deepseek_generate({"agentId": "1"})
    assert generated["stable"] is True
    assert generated["model"] == "human-approved"
    assert generated["proposal"]["nickname"] == "稳定昵称"
    assert calls["deepseek"] == 0
    version = core.save_proposal("1", generated["proposal"], generated["model"])
    assert version == 1
    assert calls["save"] == 0
    assert db.execute("SELECT COUNT(*) FROM proposals WHERE agent_id='1'").fetchone()[0] == 1


def test_non_stable_agent_keeps_legacy_generate_path():
    db = make_db()
    calls = {"deepseek": 0, "save": 0}

    def deepseek(profile):
        calls["deepseek"] += 1
        return {"proposal": {"headline": "新方案"}, "model": "deepseek", "usage": {}}

    def save(*args):
        calls["save"] += 1
        return 2

    core = SimpleNamespace(database=lambda: db, proposal_history=lambda agent_id: [], deepseek_generate=deepseek, save_proposal=save)
    stable_runtime.install(core)
    generated = core.deepseek_generate({"agentId": "2"})
    assert generated["proposal"]["headline"] == "新方案"
    assert calls["deepseek"] == 1
    assert core.save_proposal("2", generated["proposal"], generated["model"]) == 2
    assert calls["save"] == 1


def test_all_local_index_assets_are_cache_busted():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    refs = re.findall(r'(?:src|href)="([^\"]+\.(?:js|css)(?:\?[^\"]*)?)"', html)
    assert refs
    missing = [ref for ref in refs if "?v=" not in ref]
    assert missing == [], missing
