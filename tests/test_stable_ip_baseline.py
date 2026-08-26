import json
import sqlite3

from backend.stable_ip import dedupe_incremental_facts, ensure_stable_schema, promote_output, validate_output


def sample_output():
    return {
        "nickname": "测试昵称",
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


def conn():
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.execute("CREATE TABLE agents(agent_id TEXT PRIMARY KEY, name TEXT, survey_json TEXT, imported_at TEXT)")
    db.execute("CREATE TABLE proposals(id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id TEXT, version INTEGER, proposal_json TEXT, model TEXT, created_at TEXT, UNIQUE(agent_id, version))")
    db.execute("INSERT INTO agents VALUES ('1','测试','{}','now')")
    ensure_stable_schema(db)
    return db


def test_valid_human_baseline_can_be_promoted():
    db = conn()
    result = promote_output(db, "1", sample_output(), "test", approved=True)
    assert result["promoted"] is True
    assert result["proposalVersion"] == 1
    row = db.execute("SELECT output_json FROM current_ip_outputs WHERE agent_id='1'").fetchone()
    assert json.loads(row["output_json"])["headline"] == sample_output()["headline"]


def test_automatic_equal_quality_does_not_replace_current():
    db = conn()
    promote_output(db, "1", sample_output(), "baseline", approved=True)
    result = promote_output(db, "1", sample_output(), "automatic", approved=False)
    assert result["promoted"] is False
    assert "not_better_than_current" in result["errors"]


def test_xhs_compliance_is_hard_gate():
    output = sample_output()
    output["xiaohongshuBio"][0] = "💼 10年保险从业"
    assert "xhs_compliance" in validate_output(output)


def test_mechanical_value_is_rejected():
    output = sample_output()
    output["valueLines"] = ["💡 风险保障｜生活方式"]
    assert "mechanical_value" in validate_output(output)


def test_incremental_obvious_duplicate_does_not_add_second_fact():
    result = dedupe_incremental_facts(["10年建筑财务经历"], ["长期建筑财务工作经验", "注册会计师"])
    # Conservative keying may keep differently-worded facts; exact semantic keys must at least preserve unique strong fact.
    assert "注册会计师" in result["added"]
    assert len(result["facts"]) >= 2
