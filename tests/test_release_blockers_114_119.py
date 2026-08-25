from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = (ROOT / "web" / "ip-policy-core.js").read_text(encoding="utf-8")
V6 = (ROOT / "web" / "product-rules-v6.js").read_text(encoding="utf-8")
V7 = (ROOT / "web" / "product-rules-v7.js").read_text(encoding="utf-8")
V10 = (ROOT / "web" / "product-rules-v10.js").read_text(encoding="utf-8")
V19 = (ROOT / "web" / "product-rules-v19.js").read_text(encoding="utf-8")
V22 = (ROOT / "web" / "product-rules-v22.js").read_text(encoding="utf-8")
V25 = (ROOT / "web" / "product-rules-v25.js").read_text(encoding="utf-8")
V27 = (ROOT / "web" / "product-rules-v27.js").read_text(encoding="utf-8")
FLOAT = (ROOT / "web" / "profile-float.js").read_text(encoding="utf-8")
V29 = (ROOT / "web" / "product-rules-v29.js").read_text(encoding="utf-8")
SEMANTIC = (ROOT / "backend" / "profile_semantic.py").read_text(encoding="utf-8")
RULES = (ROOT / "rules" / "ip-headline-slogan-rules.md").read_text(encoding="utf-8")


def test_114_122_ip_conversation_forces_floating_profile_entry_visible():
    assert "function isIpConversationVisible" in FLOAT
    assert "function settleVisibility" in FLOAT
    assert "queueMicrotask(syncVisibility)" in FLOAT
    assert "requestAnimationFrame" in FLOAT
    assert "actions.style.display=visible?'flex':'none'" in FLOAT
    assert "aia-ip-conversation-active" in FLOAT
    assert "function closeStaleOverlaysForIp" in FLOAT
    assert "document.body.classList.remove('proposal-open')" in FLOAT
    assert "if(tool==='ip')closeStaleOverlaysForIp()" in FLOAT
    # 启动完成后必须继续以最终 DOM 为准，不能重新依赖 state.activeTool。
    assert "state.activeTool==='ip'" not in FLOAT
    assert "const chat=document.getElementById('ip-chat-panel')" in FLOAT
    assert "if(chat&&!chat.classList.contains('hidden'))closeStaleOverlaysForIp()" in FLOAT


def test_115_existing_nickname_advice_reuses_proposal_card_component():
    assert "proposal-card nickname-audit-card" in V29


def test_120_124_bio_line_length_and_same_dimension_packing_are_enforced():
    assert "const BIO_PREFERRED_MIN=12" in CORE
    assert "const BIO_PREFERRED_MAX=20" in CORE
    assert "const BIO_ABSOLUTE_MAX=25" in CORE
    block = CORE.split("function packBioItems", 1)[1].split("function rebalanceBioLines", 1)[0]
    assert "const merged=`${lines[i-1]}｜${lines[i]}`" in block
    assert "packed.filter(line=>charWeight(line)>=BIO_PREFERRED_MIN)" in block
    dimensions = CORE.split("function dimensionLines", 1)[1].split("function dedupeBioLines", 1)[0]
    assert "packBioItems(identityCore)" in dimensions
    assert "packBioItems(advantages)" in dimensions
    assert "packBioItems(values)" in dimensions
    assert "identityCore" in dimensions and "advantages" in dimensions and "values" in dimensions
    # 最终可见/复制层再做一次兜底，防止短 slogan 或历史方案绕过 Core 的正文 packing。
    assert "function sanitizeBioBlocks" in V10
    assert "lineWeight(visibleBioText(line))>=BIO_MIN" in V10
    assert "isFixedFooter(line)" in V10
    assert "textarea.value=safe.join('\\n')" in V10


def test_117_summary_line_gets_next_non_repeating_emoji():
    block = CORE.split("function buildBios", 1)[1].split("function enforceProposal", 1)[0]
    assert "const body=bioBody(profile,platform)" in block
    assert "BIO_EMOJIS[body.length % BIO_EMOJIS.length]" in block
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


def test_119_headline_rejects_mechanical_trait_label_templates():
    clean = CORE.split("function cleanHeadlineCandidate", 1)[1].split("function headlineFallback", 1)[0]
    fallback = CORE.split("function headlineFallback", 1)[1].split("function headline(profile", 1)[0]
    assert "是我的标签" in clean
    assert "是我的专业底色" in clean
    assert "做一个让人记得住的人" in clean
    assert "是我的标签" not in fallback
    assert "是我的专业底色" not in fallback
    assert "bioTraitFacts(profile)" not in fallback
    assert "#119" in RULES
    assert "宝妈，靠谱是我的标签" in RULES


def test_loaded_nickname_helpers_cannot_restore_single_character_name_slicing():
    assert "name.slice(1)" not in V19
    assert "name.slice(-1)" not in V19
    assert "name.slice(1)" not in V29
    assert "name.length===2" not in V29
    assert "阿', '小" not in V19
    assert "'哥', '姐', '老师', '总'" not in V19


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
    assert "单独出现“财务/法律/教育”等领域关键词不能升级为人物经历" in V27
    assert "def _explicit_career_context" in SEMANTIC
    assert 'key == "previousCareer" and not _explicit_career_context(proof)' in SEMANTIC
    assert "单独出现“财务/法律/教育/医疗”等领域关键词不得写入" in SEMANTIC
