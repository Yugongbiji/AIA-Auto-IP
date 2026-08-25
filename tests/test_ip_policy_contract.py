from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
POLICY = (WEB / "ip-policy-core.js").read_text(encoding="utf-8")
INDEX = (WEB / "index.html").read_text(encoding="utf-8")
V10 = (WEB / "product-rules-v10.js").read_text(encoding="utf-8")
V19 = (WEB / "product-rules-v19.js").read_text(encoding="utf-8")
V22 = (WEB / "product-rules-v22.js").read_text(encoding="utf-8")
V28 = (WEB / "product-rules-v28.js").read_text(encoding="utf-8")
V29 = (WEB / "product-rules-v29.js").read_text(encoding="utf-8")
FLOAT = (WEB / "profile-float.js").read_text(encoding="utf-8")


def test_ip_policy_is_loaded_after_legacy_layers():
    assert INDEX.index('nickname-policy-v1.js') < INDEX.index('ip-policy-core.js')
    assert INDEX.index('product-rules-v29.js') < INDEX.index('ip-policy-core.js')


def test_bio_has_single_compliance_footer_owner_and_exact_fixed_copy():
    assert 'function complianceFooter(profile,platform)' in POLICY
    assert "const VIDEO_DISCLAIMER='本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见';" in POLICY
    assert "const XHS_DISCLAIMER='本账号所述内容为个人意见，不代表任何官方意见。';" in POLICY
    footer=POLICY.split('function complianceFooter(profile,platform)',1)[1].split('function buildBios',1)[0]
    assert "return [VIDEO_DISCLAIMER,`营销服务部：${department||'待补充'}`,`执业证编号：${license||'待补充'}`]" in footer
    assert "if(platform==='xhs') return [XHS_DISCLAIMER]" in footer
    assert "'000'" not in footer and 'agentId' not in footer and 'agent_id' not in footer


def test_bio_single_recommendation_per_platform_and_owner_enforces_it():
    assert "return [{label,focus:'我是谁 + 我的优势 + 我能提供什么价值',lines:" in POLICY
    assert 'proposal.bios.xiaohongshu=buildBios' in POLICY.replace(' ', '')
    assert 'proposal.bios.videoDouyin=buildBios' in POLICY.replace(' ', '')


def test_bio_dimensions_are_explicit_and_packed_independently():
    assert "const identityCore=assets.filter(a=>a.type==='identity'" in POLICY
    assert "const advantages=assets.filter(a=>a.type==='advantage')" in POLICY
    assert "const values=assets.filter(a=>a.type==='value')" in POLICY
    assert 'packBioItems(identityCore)' in POLICY
    assert 'packBioItems(advantages)' in POLICY
    assert 'packBioItems(values)' in POLICY


def test_bio_short_line_gate_and_line_ranges_are_owned_by_core():
    assert 'const BIO_PREFERRED_MIN=12' in POLICY
    assert 'const BIO_PREFERRED_MAX=20' in POLICY
    assert 'const BIO_ABSOLUTE_MAX=25' in POLICY
    assert 'packed.filter(line=>charWeight(line)>=BIO_PREFERRED_MIN)' in POLICY


def test_bio_summary_line_has_emoji_and_is_not_plain_text():
    block=POLICY.split('function buildBios',1)[1].split('function enforceProposal',1)[0]
    assert 'const sloganLine=slogan?emojiLine' in block
    assert 'BIO_EMOJIS[body.length % BIO_EMOJIS.length]' in block


def test_headline_rejects_mechanical_label_templates():
    block=POLICY.split('function cleanHeadlineCandidate',1)[1].split('function headlineFallback',1)[0]
    assert '是我的标签' in block
    assert '是我的专业底色' in block
    assert '做一个让人记得住的人' in block


def test_floating_profile_visibility_uses_dom_truth_and_post_start_sync():
    assert 'function isIpConversationVisible' in FLOAT
    visible=FLOAT.split('function isIpConversationVisible',1)[1].split('function closeProfileDetail',1)[0]
    assert 'state.activeTool' not in visible
    assert "!chat.classList.contains('hidden')" in visible
    assert 'floatingUiStartWorkspace' in FLOAT and 'queueMicrotask(syncVisibility)' in FLOAT and 'requestAnimationFrame(syncVisibility)' in FLOAT


def test_existing_nickname_audit_reuses_proposal_card_component():
    assert "card.className='proposal-card nickname-audit-card'" in V29


def test_personal_intro_is_not_removed_by_old_profile_layers():
    v8=(WEB/'product-rules-v8.js').read_text(encoding='utf-8')
    assert "if (label === '生成偏好') group.remove()" in v8
    assert "label === '个人介绍'" not in v8 and "label === '自我介绍'" not in v8


def test_compliance_ui_does_not_generate_bios_and_has_two_columns():
    assert 'proposal.bios=' not in V10.replace(' ','')
    assert "['可以说',cfg.can" in V10 and "['不可以说',cfg.cannot" in V10 and '返回检查' not in V10
    assert "b.textContent='?'" in V10
    assert 'position:absolute' in V10 and 'right:14px' in V10 and 'top:14px' in V10
    assert 'appendThird' not in V10
    assert "hs[0].textContent='小红书简介 · 推荐版'" in V10
    assert "hs[1].textContent='视频号 / 抖音简介 · 推荐版'" in V10


def test_clipboard_success_has_one_owner():
    assert 'navigator.clipboard.writeText =' not in V22 and 'copyStateObserver' not in V22 and 'ownsClipboard:false' in V22
    assert 'writeClipboard' in V28 and "successLabel='复制成功'" in V28 and 'button.textContent=successLabel' in V28 and 'show(successLabel)' in V28


def test_old_nickname_layer_does_not_own_final_options():
    assert 'proposal.nicknameOptions=' not in V19.replace(' ','')
    assert 'ownsNicknameOptions:false' in V29
