from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_requirements_ledger_exists_and_declares_versioned_rules():
    text = read("docs/product/CURRENT_EFFECTIVE_REQUIREMENTS_LEDGER_20260825.md")
    assert "最新明确确认的需求覆盖冲突维度" in text
    assert "SUPERSEDED" in text
    assert "当前需要产品负责人确认的冲突项" in text


def test_composer_has_no_second_selection_source_or_hidden_click_submit():
    interaction = read("web/interaction-v2.js")
    submit = read("web/composer-submit-v2.js")
    assert "const selected = new Set()" not in interaction
    assert "confirm.click" not in interaction
    assert "querySelector('.multi-confirm')" not in submit
    assert "confirmMultiOption()" in submit
    assert "confirmPlanningMulti(question)" in submit


def test_xhs_emoji_cadence_matches_dedicated_rule_not_two_sentence_overreach():
    contract = read("backend/xhs_formatting_contract.py")
    rules = read("docs/脚本改写与小红书排版规则.md")
    assert "每 2 至 3 句话配置 1 个" in rules
    assert "emoji_free_run < 3" in contract
    assert "every consecutive two sentences" not in contract


def test_nickname_rules_keep_people_anchor_and_reject_mechanical_templates():
    baseline = read("docs/product/CURRENT_PRODUCT_RULES_BASELINE_20260824.md")
    nickname = read("docs/昵称受控词库与模板-V1-20260824.md")
    owner = read("web/nickname-policy-v1.js")
    assert "昵称**必须包含人物称呼**" in baseline
    assert "六类受控模板" in nickname
    assert "成都+称呼" in baseline
    assert "function controlledOptions" in owner
    assert "nicknameNeedsIdentity" in owner


def test_bio_footer_remains_single_owner():
    core = read("web/ip-policy-core.js")
    baseline = read("docs/product/CURRENT_PRODUCT_RULES_BASELINE_20260824.md")
    assert "只有 `complianceFooter` 有权追加" in baseline
    assert "function complianceFooter" in core
    assert "执业证编号：${license||'000'}" in core
    assert "营销服务部：${department||'待补充'}" in core


def test_customer_feedback_latest_requirement_supersedes_single_summary():
    ledger = read("docs/product/CURRENT_EFFECTIVE_REQUIREMENTS_LEDGER_20260825.md")
    profile = read("web/product-rules-v27.js")
    assert "客户反馈必须独立为“客户反馈”板块" in ledger
    assert "大家怎么称呼我" in profile
    assert "他们和我的关系" in profile
    assert "他们眼中的我" in profile
    assert "他们愿意找我聊什么" in profile


def test_script_recommendation_reads_canonical_directions():
    recommendation = read("web/script-recommendation-v1.js")
    assert "p.contentMainline" in recommendation
    assert "p.secondaryContent" in recommendation
    assert "buildIpContentStrategy" not in recommendation


def test_no_retired_dynamic_v33_revival():
    index = read("web/index.html")
    nav = read("web/script-recommendation-navigation-fix.js")
    assert "product-integration-v33.js" not in index
    assert "product-integration-v33.js" not in nav
