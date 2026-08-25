from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = (ROOT / "web" / "ip-policy-core.js").read_text(encoding="utf-8")
V6 = (ROOT / "web" / "product-rules-v6.js").read_text(encoding="utf-8")
V7 = (ROOT / "web" / "product-rules-v7.js").read_text(encoding="utf-8")
V10 = (ROOT / "web" / "product-rules-v10.js").read_text(encoding="utf-8")
V13 = (ROOT / "web" / "product-rules-v13.js").read_text(encoding="utf-8")
V19 = (ROOT / "web" / "product-rules-v19.js").read_text(encoding="utf-8")
V22 = (ROOT / "web" / "product-rules-v22.js").read_text(encoding="utf-8")
V25 = (ROOT / "web" / "product-rules-v25.js").read_text(encoding="utf-8")
V27 = (ROOT / "web" / "product-rules-v27.js").read_text(encoding="utf-8")
FLOAT = (ROOT / "web" / "profile-float.js").read_text(encoding="utf-8")
FLOAT_CSS = (ROOT / "web" / "profile-float.css").read_text(encoding="utf-8")
V29 = (ROOT / "web" / "product-rules-v29.js").read_text(encoding="utf-8")
SEMANTIC = (ROOT / "backend" / "profile_semantic.py").read_text(encoding="utf-8")
RULES = (ROOT / "rules" / "ip-headline-slogan-rules.md").read_text(encoding="utf-8")


def test_127_floating_ip_owner_is_isolated_from_legacy_panel_and_overlay_state():
    assert "const IDS = Object.freeze" in FLOAT
    assert "aia-ip-owner-actions" in FLOAT
    assert "aia-ip-owner-profile-drawer" in FLOAT
    assert "function workspaceVisible" in FLOAT
    assert "state.activeTool" not in FLOAT
    assert "closeStaleOverlaysForIp" not in FLOAT
    assert "document.body.classList" not in FLOAT
    for legacy_overlay in ["proposal-screen", "content-plan-screen", "script-detail-screen"]:
        assert legacy_overlay not in FLOAT
    assert "document.querySelector('.profile-panel')" not in FLOAT
    assert "actions.hidden = !visible" in FLOAT
    assert "proposalButton.hidden = !latestProposal()" in FLOAT
    assert "owner: 'web/profile-float.js'" in FLOAT
    assert "independentDrawer: true" in FLOAT
    assert ".profile-panel { display:none!important; }" in FLOAT_CSS


def test_127_floating_profile_drawer_contains_confirmed_information_sections():
    for section in ["基本资料", "经历与优势资料", "账号资料", "客户反馈", "个人介绍"]:
        assert section in FLOAT
    for field in ["姓名", "营销员编号", "所在城市", "营销服务部", "保险从业时间", "学历", "学校背景", "过往职业 / 工作经历", "荣誉", "长期身份", "原视频号昵称", "做自媒体目的", "账号运营状态", "当前卡点"]:
        assert field in FLOAT
    for feedback in ["大家怎么称呼我", "他们和我的关系", "他们眼中的我", "他们愿意找我聊什么", "他们觉得我更像哪种人", "他们怎么向别人介绍我"]:
        assert feedback in FLOAT
    assert "`${label} ×${count}`" in FLOAT


def test_135_floating_actions_use_fixed_safe_zone_above_composer():
    compact = FLOAT_CSS.replace(' ', '').replace('\n', '')
    assert '.aia-ip-owner-actions{' in compact
    assert 'bottom:104px' in compact
    assert 'bottom:calc(88px+env(safe-area-inset-bottom,0px))' in compact
    assert 'touch-action:none' not in FLOAT_CSS


def test_132_questionnaire_keeps_education_and_expression_style_when_missing():
    assert "educationQuestion.chips = ['大专', '本科', '硕士', '博士']" in V13
    assert "educationQuestion.collectIfMissing = true" in V13
    assert "styleQuestion.collectIfMissing = true" in V13
    assert "styleQuestion.multiple = true" in V13
    assert "styleQuestion.maxSelections = 2" in V13
    assert '这个选择会影响后续的脚本改写风格' in V13


def test_135_questionnaire_persistence_never_blocks_next_question():
    assert 'questionnaireNonBlockingPersist' in V13
    assert 'profileSaveQueue' in V13
    assert 'return Promise.resolve()' in V13
    assert 'QUESTIONNAIRE_OWNED_FIELDS' in V27
    assert 'QUESTIONNAIRE_OWNED_FIELDS.has(key)' in V27
    semantic_block = V27.split('async function semanticEnrich', 1)[1].split('function normalizeCountItems', 1)[0]
    assert 'state.currentQuestion' not in semantic_block
    assert 'presentQuestion()' not in semantic_block


def test_115_existing_nickname_advice_reuses_proposal_card_component():
    assert "proposal-card nickname-audit-card" in V29


def test_120_124_bio_final_owner_packs_only_same_dimensions_and_drops_short_lines():
    assert "const BIO_PREFERRED_MIN=12" in CORE
    assert "const BIO_PREFERRED_MAX=20" in CORE
    assert "const BIO_ABSOLUTE_MAX=25" in CORE
    assert "function packDimension(items,maxLines=3)" in CORE
    pack = CORE.split("function packDimension", 1)[1].split("function bioDimensions", 1)[0]
    assert "charWeight(candidate)>BIO_PREFERRED_MAX" in pack
    assert "charWeight(built)>=BIO_PREFERRED_MIN" in pack
    assert "charWeight(v)>=BIO_PREFERRED_MIN&&charWeight(v)<=BIO_ABSOLUTE_MAX" in pack
    dims = CORE.split("function bioDimensions", 1)[1].split("function dimensionLines", 1)[0]
    assert "const identity=[]" in dims and "advantage=[]" in dims and "value=[]" in dims
    assert "identity.push" in dims and "advantage.push" in dims and "value.push" in dims
    # V10 是纯 UI，不得再二次过滤正文，否则会复发“只剩合规声明”。
    assert "sanitizeBioBlocks" not in V10
    assert "textarea.value=" not in V10
    assert "ownsBioText:false" in V10


def test_117_summary_line_gets_next_non_repeating_emoji():
    block = CORE.split("function buildBios", 1)[1].split("function bioAssets", 1)[0]
    assert "body=bioBody(profile,platform)" in block
    assert "BIO_EMOJIS[body.length%BIO_EMOJIS.length]" in block
    assert "sloganLine" in block


def test_118_123_compliance_help_keeps_question_mark_and_right_side_placement():
    assert "b.textContent='?'" in V10
    assert "查看昵称合规提示" in V10
    assert "查看简介合规提示" in V10
    assert "width:28px" in V10 and "border-radius:50%" in V10
    assert "position:absolute!important" in V10
    assert "right:16px" in V10
    assert "card.appendChild(b)" in V10
    assert "insertAdjacentElement('afterend'" not in V10


def test_119_headline_rejects_mechanical_trait_and_credential_wall_templates():
    clean = CORE.split("function cleanHeadlineCandidate", 1)[1].split("function headlineFallback", 1)[0]
    fallback = CORE.split("function headlineFallback", 1)[1].split("function headline(profile", 1)[0]
    assert "是我的标签" in clean
    assert "是我的专业底色" in clean
    assert "做一个让人记得住的人" in clean
    assert "本科|硕士|博士|大专" in clean and "MDRT|COT|TOT" in clean
    assert "是我的标签" not in fallback
    assert "是我的专业底色" not in fallback
    assert "#119" in RULES
    assert "宝妈，靠谱是我的标签" in RULES


def test_loaded_nickname_helpers_cannot_restore_single_character_name_slicing():
    assert "name.slice(1)" not in V19
    assert "name.slice(-1)" not in V19
    assert "name.slice(1)" not in V29
    assert "name.length===2" not in V29


def test_visible_bio_ui_removes_retired_000_placeholder_and_old_multi_set_copy():
    assert "content.querySelectorAll('.license-note')" in V10
    assert "/000/.test" in V10
    assert "三套选择" not in V10
    assert "小红书简介 · 推荐版" in V10
    assert "视频号 / 抖音简介 · 推荐版" in V10


def test_fixed_creative_loading_copy_cannot_be_rewritten_by_legacy_layers():
    assert "xhs:'正在排版，请稍候…'" in V22
    assert "script:'正在改写，请稍候…'" in V22
    assert "FIXED_CREATIVE_STATUS" in V6
    assert "FIXED_CREATIVE_STATUS.has(text)" in V6
    assert "见证奇迹的时刻到啦" not in V7
    assert "收到啦！✍️ 我正在认真改写" not in V7
    assert "text === '正在排版，请稍候…'" in V7


def test_preview_helper_cannot_restore_full_document_observer():
    assert "observe(document.body" not in V25.replace(" ", "")
    assert "ensurePreviewResetButton();" in V25


def test_generic_intro_keywords_cannot_upgrade_to_previous_career():
    assert "function explicitCareerIntro" in V27
    assert "field === 'previousCareer' ? explicitCareerIntro(intro) : intro" in V27
    assert "def _explicit_career_context" in SEMANTIC
    assert 'key == "previousCareer" and not _explicit_career_context(proof)' in SEMANTIC
    assert "单独出现“财务/法律/教育/医疗”等领域关键词不得写入" in SEMANTIC
