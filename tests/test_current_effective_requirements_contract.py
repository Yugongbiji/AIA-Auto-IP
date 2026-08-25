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


def test_xhs_emoji_density_uses_latest_v4_specialized_rule():
    contract = read("backend/xhs_formatting_contract.py")
    current_rules = read("rules/xhs-formatting-rules.md")
    older_rules = read("docs/脚本改写与小红书排版规则.md")
    assert "本文件补充并更新" in current_rules
    assert "任何连续 2 个完整句子中，至少有 1 个表情" in current_rules
    assert "每 2 至 3 句话配置 1 个" in older_rules
    assert "def _strict_scan_emojis" in contract
    assert "emoji_free_run < 2" in contract
    assert "_cadenced_scan_emojis" not in contract


def test_nickname_rules_keep_people_anchor_and_reject_mechanical_templates():
    baseline = read("docs/product/CURRENT_PRODUCT_RULES_BASELINE_20260824.md")
    nickname = read("docs/昵称受控词库与模板-V1-20260824.md")
    owner = read("web/nickname-policy-v1.js")
    assert "昵称**必须包含人物称呼**" in baseline
    assert "六类受控模板" in nickname
    assert "成都+称呼" in baseline
    assert "function controlledOptions" in owner
    assert "nicknameNeedsIdentity" in owner
    assert "function educationAsset" in owner
    assert "function achievementAsset" in owner
    assert "function regionAsset" in owner
    assert "function aiFallbackOptions" in owner
    assert "n===`${asset}${anchor}`" in owner


def test_nickname_anchor_priority_and_existing_nickname_evidence_are_explicit():
    owner = read("web/nickname-policy-v1.js")
    peer = owner.index("...peerAnchors(p)")
    preferred = owner.index("...preferredAnchors(p)")
    existing = owner.index("...existingPersonAnchors(p)")
    natural = owner.index("...naturalNameAnchors(p)")
    assert -1 not in (peer, preferred, existing, natural)
    assert peer < preferred < existing < natural
    assert "已有昵称包含稳定人物称呼" in owner


def test_bio_latest_rules_replace_three_strategies_and_mechanical_reduction():
    core = read("web/ip-policy-core.js")
    bio_rules = read("docs/简介受控词库与模板-V1-20260824.md")
    ledger = read("docs/product/CURRENT_EFFECTIVE_REQUIREMENTS_LEDGER_20260825.md")
    baseline = read("docs/product/CURRENT_PRODUCT_RULES_BASELINE_20260824.md")

    assert "三个维度均可根据真实资料丰富程度使用 **1–3 行**" in bio_rules
    assert "小红书简介：1 套最终推荐版" in bio_rules
    assert "视频号 / 抖音简介：1 套共用最终推荐版" in bio_rules
    assert "取消机械减法" in bio_rules
    assert "每一行必须保持同一语义维度" in bio_rules
    assert "硕士学历”优先精简为“硕士" in bio_rules

    assert "同一平台固定生成三套简介" in ledger
    assert "机械减法" in ledger
    assert "function bioCareerFacts" in core
    assert "function packBioItems" in core
    assert "function dimensionLines" in core
    assert "小红书简介 · 推荐版" in core
    assert "视频号 / 抖音简介 · 推荐版" in core
    assert "方案 A · 专业背书" not in core
    assert "方案 B · 人设记忆" not in core
    assert "方案 C · 价值服务" not in core
    assert "只有 `complianceFooter` 有权追加" in baseline
    assert "function complianceFooter" in core
    assert "执业证编号：${license||'待补充'}" in core
    assert "营销服务部：${department||'待补充'}" in core


def test_bio_fact_boundary_and_customer_feedback_are_not_ai_explanations():
    core = read("web/ip-policy-core.js")
    bio_rules = read("docs/简介受控词库与模板-V1-20260824.md")
    assert "BIO_GENERIC_DOMAINS" in core
    assert "^(法律|教育|金融|医疗" in core
    assert "bioCareerFacts" in core
    assert "客户比较常提到我" not in core
    assert "客户高频评价" not in core
    assert "只呈现结论，不解释证据来源" in bio_rules
    assert "资料只有“法律”" in bio_rules
    assert "6年企业法务工作经验" in bio_rules


def test_bio_keeps_high_information_density_without_old_numeric_caps():
    core = read("web/ip-policy-core.js")
    rules = read("docs/简介受控词库与模板-V1-20260824.md")
    assert "单位空间信息量越高越好" in rules
    assert "function charWeight" in core
    assert "maxLines=3" in core
    assert "services.slice(0,4)" not in core
    assert "interests.join('、'),items:interests" not in core
    assert "return uniq(out).slice(0,3)" not in core.split("function bioEducationFacts", 1)[1].split("function bioHonorFacts", 1)[0]


def test_customer_feedback_latest_requirement_supersedes_single_summary():
    ledger = read("docs/product/CURRENT_EFFECTIVE_REQUIREMENTS_LEDGER_20260825.md")
    profile = read("web/product-rules-v27.js")
    assert "客户反馈独立为“客户反馈”板块" in ledger
    assert "不能塞进一个摘要字段" in ledger
    assert "大家怎么称呼我" in profile
    assert "他们和我的关系" in profile
    assert "他们眼中的我" in profile
    assert "他们愿意找我聊什么" in profile


def test_script_recommendation_reads_canonical_directions_and_tracks_handoffs():
    recommendation = read("web/script-recommendation-v1.js")
    assert "p.contentMainline" in recommendation
    assert "p.secondaryContent" in recommendation
    assert "buildIpContentStrategy" not in recommendation
    assert "'rewrite_click'" in recommendation
    assert "'xhs_click'" in recommendation


def test_no_retired_dynamic_v33_revival():
    index = read("web/index.html")
    nav = read("web/script-recommendation-navigation-fix.js")
    assert "product-integration-v33.js" not in index
    assert "product-integration-v33.js" not in nav


def test_field_schema_treats_purpose_as_raw_and_requires_person_anchor():
    schema = read("rules/field-schema.md")
    assert "`purpose` 只是历史/报名 raw source" in schema
    assert "最终业务目标只有 `primaryGoal`" in schema
    assert "没有可用称呼时不得生成不含人物主体" in schema
    assert "打造个人品牌" in schema
    assert "必须重新询问" in schema
    assert "不希望填写" not in schema.split("学历 `education`")[1].split("|", 5)[0]


def test_dialogue_rules_do_not_restore_retired_planning_or_old_loading_copy():
    dialogue = read("rules/dialogue-style-rules.md")
    assert "独立“内容规划问答”已撤销" in dialogue
    assert "正在排版，请稍候…" in dialogue
    assert "正在改写，请稍候…" in dialogue
    assert "旧的“见证奇迹”" in dialogue


def test_compliance_rule_does_not_regrant_nickname_brand_generation():
    compliance = read("rules/compliance-rules.md")
    assert "不会主动生成或推荐含“友邦 / AIA / 保险”" in compliance
    assert "固定尾部只由 `web/ip-policy-core.js:complianceFooter()` 追加" in compliance
    assert "7 天内最多修改 3 次，频繁修改也可能影响账号稳定" in compliance


def test_content_goal_boundary_uses_canonical_primary_goal_only():
    boundary = read("rules/content-goal-boundary-rules.md")
    assert "只读标准化 `primaryGoal`" in boundary
    assert "原始报名字段 `purpose` 只作为目标判断输入" in boundary
    assert "必须重新询问并二选一" in boundary
    assert "不存在第三种“双主线”最终状态" in boundary
