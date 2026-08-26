from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
BACKEND = ROOT / "backend"

CORE = (WEB / "ip-policy-core.js").read_text(encoding="utf-8")
NICK = (WEB / "nickname-policy-v1.js").read_text(encoding="utf-8")
BRANCH = (WEB / "product-rules-v14.js").read_text(encoding="utf-8")
PROFILE = (WEB / "product-rules-v27.js").read_text(encoding="utf-8")
NICK_AUDIT = (WEB / "product-rules-v29.js").read_text(encoding="utf-8")
DETAIL = (WEB / "product-rules-v17.js").read_text(encoding="utf-8")
RECOMMEND = (WEB / "script-recommendation-v1.js").read_text(encoding="utf-8")
RECOMMEND_CSS = (WEB / "script-recommendation-v1.css").read_text(encoding="utf-8")
ROUTING = (WEB / "api-routing-v1.js").read_text(encoding="utf-8")
CACHE = (WEB / "product-rules-v16.js").read_text(encoding="utf-8")
V9 = (WEB / "product-rules-v9.js").read_text(encoding="utf-8")
V10 = (WEB / "product-rules-v10.js").read_text(encoding="utf-8")
V22 = (WEB / "product-rules-v22.js").read_text(encoding="utf-8")
V28 = (WEB / "product-rules-v28.js").read_text(encoding="utf-8")
SCRIPT_SERVER = (ROOT / "script_server.py").read_text(encoding="utf-8")
SEMANTIC = (BACKEND / "profile_semantic.py").read_text(encoding="utf-8")
XHS = (BACKEND / "xhs_formatting_contract.py").read_text(encoding="utf-8")
PERSONA_GENERATOR = (BACKEND / "ip_persona_generator.py").read_text(encoding="utf-8")
CREATIVE_CONTRACTS = (BACKEND / "script_persona_rules.py").read_text(encoding="utf-8")
PROMPT = (ROOT / "prompts" / "ip-persona-prompt.md").read_text(encoding="utf-8")


def test_goal_controls_recruitment_questions_and_whole_proposal():
    for token in ["recruitmentGroups", "recruitmentAges", "准增员对象", "准增员年龄段"]:
        assert token in CORE
    recruitment_age_block = CORE.split("ages.key='recruitmentAges'", 1)[1].split("else{ages.key='customerAges'", 1)[0]
    assert "55 岁以上" not in recruitment_age_block
    for output in ["proposal.clientPortrait=targetPortrait", "proposal.advantages=advantageItems", "proposal.contentMainline=", "proposal.secondaryContent=", "proposal.bios={xiaohongshu:"]:
        assert output in CORE


def test_canonical_proposal_is_applied_before_use_and_persisted():
    assert "enforceProposal(payload.proposal" in CORE
    assert "state.proposals=[lastGenerated]" in CORE
    assert "/api/proposal/canonical" in CORE
    assert "persistCanonical" in CORE
    assert 'path == "/api/proposal/canonical"' in SCRIPT_SERVER
    assert "UPDATE proposals SET proposal_json" in SCRIPT_SERVER


def test_core_no_longer_uses_content_plan_or_active_tool_as_output_owner():
    assert "planningState.plans" not in CORE
    assert "state.activeTool==='script'" not in CORE
    assert "selectTool('ip')" not in CORE


def test_profile_semantics_are_goal_aware_and_frontend_reconnected():
    assert "/api/profile/analyze" in PROFILE
    assert "semanticEnrich" in PROFILE
    assert "currentSemanticKey" in PROFILE
    assert "recruitmentGroups" in SEMANTIC and "recruitmentAges" in SEMANTIC
    assert 'goal == "recruitment"' in SEMANTIC
    assert 'allowed -= {"customerGroups", "customerAges"}' in SEMANTIC


def test_customer_feedback_has_one_display_owner():
    assert "ownsPeerFeedback:true" in PROFILE.replace(" ", "")
    assert "renderPeerFeedback" in PROFILE
    assert "renderStructuredFeedback" not in NICK_AUDIT
    assert "ownsPeerFeedback:false" in NICK_AUDIT.replace(" ", "")


def test_nickname_uses_peer_feedback_first_and_never_falls_back_to_unanchored_ai():
    anchors_block = NICK.split("function anchors", 1)[1].split("function pickAnchor", 1)[0]
    assert anchors_block.index("peerAnchors") < anchors_block.index("naturalNameAnchors")
    compact=NICK.replace(" ", "")
    assert "proposal.nicknameOptions=rankByMemory(controlled,p,a,existing).slice(0,5)" in compact
    assert "proposal.nicknameNeedsIdentity=!a" in compact
    assert "if(!anchor||!Array.isArray(rawOptions))return[]" in compact


def test_content_branch_ranking_accumulates_evidence_and_goal_bonus():
    assert "current.evidenceScore += strength" in BRANCH
    assert "multiSourceBonus" in BRANCH
    assert "RECRUITMENT_BONUS" in BRANCH and "CUSTOMER_BONUS" in BRANCH
    assert "unknownDirection" in BRANCH


def test_script_library_restores_real_paging_responsive_grid_and_detail_contract():
    for token in ["script-library-pagination", "上一页", "下一页", "共 ${Number(data.total||0)} 条", "openDetail"]:
        assert token in RECOMMEND
    assert "grid-template-columns:repeat(2,minmax(0,1fr))" in RECOMMEND_CSS
    assert "@media(max-width:700px)" in RECOMMEND_CSS and ".script-library-grid{grid-template-columns:1fr" in RECOMMEND_CSS
    assert "window.aiaScriptRecommendation=Object.freeze" in RECOMMEND
    assert "openDetail" in RECOMMEND.split("window.aiaScriptRecommendation=Object.freeze", 1)[1]
    assert "window.scriptRecommendationV1" not in DETAIL
    assert "window.aiaScriptRecommendation.openDetail" in DETAIL


def test_no_whole_body_observer_returns_in_detail_paging():
    compact = DETAIL.replace(" ", "")
    assert "observe(document.body" not in compact
    assert "observe(detailScreen" in compact


def test_preview_storage_and_optional_prod_lookup_are_isolated():
    assert "aia-auto-ip-session:preview" in ROUTING
    assert "Storage.prototype" in ROUTING
    assert "withTimeout(prodPromise, 800)" in ROUTING
    assert "aia-auto-ip-profile-cache-v1:${ENV_SCOPE}" in CACHE


def test_completion_and_clipboard_have_runtime_single_owners():
    assert "renderProfile" not in V9
    assert "navigator.clipboard" not in V10
    assert "window.aiaClipboard" in V28
    assert "copyText = (text, button) => copyWithFeedback" in V28
    assert "window.aiaClipboard?.copyWithFeedback" in V10


def test_compliance_ui_cannot_mutate_final_bio():
    assert 'proposal.bios=' not in V10.replace(' ','')
    assert 'textarea.value=' not in V10
    assert 'sanitizeBioBlocks' not in V10
    assert 'ownsBioText:false' in V10


def test_loading_is_normalized_before_render_not_by_dom_observer():
    assert "addCreativeMessage=function aiaCreativeMessage" in V22
    assert "new MutationObserver" not in V22
    assert ".observe(" not in V22
    assert "正在改写，请稍候" in V22
    assert "正在排版，请稍候" in V22


def test_xhs_contract_is_two_sentence_dense_and_repairs_isolated_punctuation():
    assert "Ensure every two consecutive complete sentences contain an emoji anchor" in XHS
    assert "emoji_free_run < 2" in XHS
    assert "_ISOLATED_PUNCT" in XHS
    assert "core_module.add_scan_emojis = _strict_scan_emojis" in XHS
    assert "core_module.enforce_xhs_readability = readability" in XHS


def test_prompt_cannot_generate_or_confuse_fixed_compliance_footer():
    assert "固定合规尾部不是模型职责" in PROMPT
    assert "模型不得生成个人意见固定声明、营销服务部行、执业证编号行" in PROMPT
    assert "ip-policy-core.js::complianceFooter()" in PROMPT


def test_runtime_ip_generation_reads_prompt_file_instead_of_hardcoded_product_rules():
    assert 'PROMPT_PATH = ROOT / "prompts" / "ip-persona-prompt.md"' in PERSONA_GENERATOR
    assert "PROMPT_PATH.read_text" in PERSONA_GENERATOR
    assert "core_module.deepseek_generate = generate" in PERSONA_GENERATOR
    assert "ip_persona_generator.install(core_module)" in CREATIVE_CONTRACTS
