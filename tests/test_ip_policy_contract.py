from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'web'
POLICY = (WEB / 'ip-policy-core.js').read_text(encoding='utf-8')
INDEX = (WEB / 'index.html').read_text(encoding='utf-8')
FLOAT = (WEB / 'profile-float.js').read_text(encoding='utf-8')
V5 = (WEB / 'product-rules-v5.js').read_text(encoding='utf-8')
V6 = (WEB / 'product-rules-v6.js').read_text(encoding='utf-8')
V10 = (WEB / 'product-rules-v10.js').read_text(encoding='utf-8')
V12 = (WEB / 'product-rules-v12.js').read_text(encoding='utf-8')
V13 = (WEB / 'product-rules-v13.js').read_text(encoding='utf-8')
V16 = (WEB / 'product-rules-v16.js').read_text(encoding='utf-8')
V19 = (WEB / 'product-rules-v19.js').read_text(encoding='utf-8')
V22 = (WEB / 'product-rules-v22.js').read_text(encoding='utf-8')
V24 = (WEB / 'product-rules-v24.js').read_text(encoding='utf-8')
V27 = (WEB / 'product-rules-v27.js').read_text(encoding='utf-8')
V28 = (WEB / 'product-rules-v28.js').read_text(encoding='utf-8')
V29 = (WEB / 'product-rules-v29.js').read_text(encoding='utf-8')


def test_only_canonical_ip_integration_is_loaded():
    assert 'ip-policy-core.js' in INDEX
    for retired in [
        'product-integration-v30.js', 'product-integration-v31.js', 'product-integration-v33.js',
        'product-rules-v15.js', 'product-rules-v23.js', 'product-rules-v26.js',
    ]:
        assert retired not in INDEX


def test_legacy_layers_no_longer_own_core_business_outputs():
    for source in [V5, V6, V10, V12, V13, V16, V19, V24, V27, V29]:
        assert 'proposal.bios=' not in source.replace(' ', '')
        assert 'proposal.contentMainline=' not in source.replace(' ', '')
    assert 'ownsBusinessRules: false' in V12
    assert 'ownsBusinessRules: false' in V13
    assert 'ownsNicknameOptions:false' in V19
    assert 'ownsNicknameOptions:false' in V29


def test_goal_is_binary_and_ambiguous_purpose_requires_clarification():
    assert 'customer_acquisition' in POLICY
    assert 'recruitment' in POLICY
    assert 'if (recruit && !customer' in POLICY
    assert 'if (customer && !recruit' in POLICY
    assert 'delete profile.primaryGoal' in POLICY
    assert '吸引潜在客户' in POLICY
    assert '吸引潜在增员对象' in POLICY
    assert 'questions.splice(oldPurposeIndex, 1)' in POLICY


def test_skip_and_other_options_are_removed_centrally():
    assert 'const OMIT = /^(其他|其它|不希望填写|跳过' in POLICY
    assert 'cleanQuestionOptions' in POLICY
    assert "['大专', '本科', '硕士', '博士']" in V13


def test_lifestyle_topics_can_only_be_secondary():
    for topic in ['健康养生', '美食', '读书', '旅行', '智能家居', '骑行', '育儿']:
        assert topic in POLICY
    customer_block = POLICY.split('const CUSTOMER_MAINLINES', 1)[1].split('const RECRUITMENT_MAINLINES', 1)[0]
    for forbidden in ['健康养生', '美食', '读书', '旅行', '智能家居', '骑行', '育儿']:
        assert forbidden not in customer_block
    assert 'return [...RECRUITMENT_MAINLINES]' in POLICY
    assert 'rankIpContentBranches' in POLICY


def test_headline_does_not_use_person_name_anchor():
    block = POLICY.split('function headline(profile)', 1)[1].split('const XHS_BANNED', 1)[0]
    for forbidden in ['preferredName', 'topNicknames', 'profile?.name']:
        assert forbidden not in block


def test_bio_has_single_compliance_footer_owner_and_correct_video_order():
    assert 'function complianceFooter(profile,platform)' in POLICY
    assert 'const out=[VIDEO_DISCLAIMER]' in POLICY
    footer = POLICY.split('function complianceFooter(profile,platform)', 1)[1].split('function buildBios', 1)[0]
    assert footer.index('VIDEO_DISCLAIMER') < footer.index('营销服务部') < footer.index('执业证编号')
    assert 'agentId' not in footer
    assert 'agent_id' not in footer
    for source in [V5, V6, V10, V12, V13, V16, V19, V24, V27, V29]:
        assert 'proposal.bios=' not in source.replace(' ', '')


def test_bio_uses_real_assets_and_not_hobby_tag_wall():
    for source in ['previousCareer', 'selfIntro', 'insuranceYears', 'honors', 'peerReviewSummary', 'services']:
        assert source in POLICY
    bio_block = POLICY.split('function bioBody(profile,platform,variant)', 1)[1].split('function explicitLicense', 1)[0]
    assert 'profile?.hobbies' not in bio_block
    assert 'feedbackSentence(assets)' in bio_block
    assert '客户比较常提到我' in POLICY
    assert "asset.items.join('｜')" in POLICY


def test_missing_nickname_is_never_treated_as_keepable():
    assert 'const missing=' in V29
    assert '当前没有填写昵称' in V29
    assert "missing(rawVideo)?'':rawVideo" in V29
    assert '建议优先保留' in V29


def test_floating_buttons_are_icons_only_and_no_version_text():
    assert '<svg aria-hidden="true"' in FLOAT
    assert 'profileButton.innerHTML' in FLOAT
    assert 'proposalButton.innerHTML' in FLOAT
    assert '最新 IP 方案 · V' not in FLOAT
    assert "querySelector('span:last-child')" not in FLOAT
    assert "state.activeTool==='ip'" in FLOAT
    assert 'ownsProfileData:false' in FLOAT


def test_personal_intro_is_not_removed_by_old_profile_layers():
    v8 = (WEB / 'product-rules-v8.js').read_text(encoding='utf-8')
    assert "if (label === '生成偏好') group.remove()" in v8
    assert "label === '个人介绍'" not in v8
    assert "label === '自我介绍'" not in v8


def test_compliance_ui_does_not_generate_bios_and_has_two_columns():
    assert 'proposal.bios=' not in V10.replace(' ', '')
    assert "['可以说',cfg.can" in V10
    assert "['不可以说',cfg.cannot" in V10
    assert '返回检查' not in V10


def test_clipboard_success_has_one_owner():
    # V22 is only Toast/loading utility; V28 performs the real clipboard write and success/failure feedback.
    assert 'navigator.clipboard.writeText =' not in V22
    assert 'copyStateObserver' not in V22
    assert 'ownsClipboard:false' in V22
    assert 'writeClipboard' in V28
    assert "successLabel='复制成功'" in V28
    assert 'button.textContent=successLabel' in V28
    assert 'show(successLabel)' in V28
