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
    for retired in ['product-integration-v30.js','product-integration-v31.js','product-integration-v33.js','product-rules-v15.js','product-rules-v23.js','product-rules-v26.js']:
        assert retired not in INDEX


def test_legacy_layers_no_longer_own_core_business_outputs():
    for source in [V5,V6,V10,V12,V13,V16,V19,V24,V27,V29]:
        compact = source.replace(' ','')
        assert 'proposal.bios=' not in compact
        assert 'proposal.contentMainline=' not in compact
    assert 'ownsBusinessRules: false' in V12 and 'ownsBusinessRules: false' in V13
    assert 'ownsNicknameOptions:false' in V19 and 'ownsNicknameOptions:false' in V29
    assert 'ownsBioText:false' in V10
    assert 'textarea.value=' not in V10 and 'sanitizeBioBlocks' not in V10


def test_goal_is_binary_and_ambiguous_purpose_requires_clarification():
    assert 'customer_acquisition' in POLICY and 'recruitment' in POLICY
    assert 'recruit&&!customer' in POLICY and 'customer&&!recruit' in POLICY
    assert 'delete profile.primaryGoal' in POLICY
    assert '吸引潜在客户' in POLICY and '吸引潜在增员对象' in POLICY


def test_skip_and_other_options_are_removed_centrally_without_removing_school_none_option():
    assert 'const OMIT=' in POLICY and 'cleanQuestionOptions' in POLICY
    assert "q.key==='schoolTier'" in POLICY
    assert "['大专', '本科', '硕士', '博士']" in V13


def test_lifestyle_topics_can_only_be_secondary():
    for topic in ['健康养生','美食','读书','旅行','智能家居','骑行','育儿']:
        assert topic in POLICY
    customer_block=POLICY.split('const CUSTOMER_MAINLINES',1)[1].split('const RECRUITMENT_MAINLINES',1)[0]
    for forbidden in ['健康养生','美食','读书','旅行','智能家居','骑行','育儿']:
        assert forbidden not in customer_block
    assert 'return [...RECRUITMENT_MAINLINES]' in POLICY and 'rankIpContentBranches' in POLICY


def test_headline_is_single_natural_slogan_owner_and_rejects_mechanical_output():
    assert "function headline(profile,candidate='')" in POLICY
    clean=POLICY.split('function cleanHeadlineCandidate',1)[1].split('function transformationFacts',1)[0]
    fallback=POLICY.split('function headlineFallback',1)[1].split("function headline(profile",1)[0]
    assert "replace(/[｜|]+/g,'，')" in clean
    assert 'XHS_BANNED.test(v)' in clean
    assert '是我的标签' in clean and '是我的专业底色' in clean and '做一个让人记得住的人' in clean
    assert '本科|硕士|博士|大专' in clean and 'MDRT|COT|TOT' in clean
    assert 'nums.some' in clean and '0人脉' in clean and '擅长' in clean
    assert '懂[\\u4e00-\\u9fa5]' in clean and '多年|长期' in clean
    assert 'profile?.name' not in fallback and 'preferredName' not in fallback
    assert 'education.length&&honors.length' not in fallback


def test_headline_competes_strong_facts_and_uses_goal_as_ranking_context():
    block=POLICY.split('function headlineAssets',1)[1].split('function headlineFallback',1)[0]
    assert "'career',/\\d/.test(v)?100:82" in block
    assert "'transformation',92" in block
    assert "'honor',72" in block
    assert "'education',64" in block
    assert "'trait',58" in block
    assert "'family',52" in block
    assert "'interest',36" in block
    assert 'PRIMARY_GOALS.RECRUITMENT' in block and 'PRIMARY_GOALS.CUSTOMER' in block


def test_headline_is_reused_verbatim_in_both_bios_before_footer():
    build=POLICY.split('function buildBios',1)[1].split('function bioAssets',1)[0]
    enforce=POLICY.split('function enforceProposal',1)[1].split('function canonicalizeHistory',1)[0]
    assert 'body=bioBody(profile,platform)' in build
    assert 'slogan=text(headlineText)' in build
    assert 'sloganEmoji=pickBioEmoji' in build
    assert 'proposal.headline=slogan' in enforce
    assert "buildBios(p,'xhs',slogan)" in enforce and "buildBios(p,'video',slogan)" in enforce


def test_bio_has_single_compliance_footer_owner_and_exact_fixed_copy():
    assert "const VIDEO_DISCLAIMER='本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见';" in POLICY
    assert "const XHS_DISCLAIMER='本账号所述内容为个人意见，不代表任何官方意见。';" in POLICY
    footer=POLICY.split('function complianceFooter',1)[1].split('function buildBios',1)[0]
    assert "if(platform==='xhs')return [XHS_DISCLAIMER]" in footer
    assert "return [VIDEO_DISCLAIMER,`营销服务部：${department||'待补充'}`,`执业证编号：${license||'待补充'}`]" in footer
    assert 'agentId' not in footer and 'agent_id' not in footer and "'000'" not in footer


def test_bio_outputs_one_recommendation_per_platform_and_three_semantic_dimensions():
    assert '小红书简介 · 推荐版' in POLICY and '视频号 / 抖音简介 · 推荐版' in POLICY
    assert "focus:'我是谁 + 我的优势 + 我能提供什么价值'" in POLICY
    dims=POLICY.split('function bioDimensions',1)[1].split('function dimensionLines',1)[0]
    assert 'const identity=[]' in dims and 'advantage=[]' in dims and 'value=[]' in dims
    assert 'identity.push' in dims and 'advantage.push' in dims and 'value.push' in dims
    assert '方案 A · 专业背书' not in POLICY and '方案 B · 人设记忆' not in POLICY and '方案 C · 价值服务' not in POLICY


def test_bio_uses_strict_career_evidence_and_does_not_upgrade_generic_domain_keyword():
    assert 'function careerFacts(profile)' in POLICY and 'function normalizeCareer(value)' in POLICY
    normalize=POLICY.split('function normalizeCareer',1)[1].split('function careerFacts',1)[0]
    assert '法律|教育|金融|医疗|健康|养老|育儿|科技|互联网|房地产|管理|市场|销售|财务常识|职场|创业经营' in normalize
    career=POLICY.split('function careerFacts',1)[1].split('function educationFacts',1)[0]
    assert '曾任|曾做|从事|工作于|任职于' in career


def test_bio_layout_has_12_20_preferred_range_25_cap_and_balancing():
    assert 'const BIO_PREFERRED_MIN=12;' in POLICY
    assert 'const BIO_PREFERRED_MAX=20;' in POLICY
    assert 'const BIO_ABSOLUTE_MAX=25;' in POLICY
    pack=POLICY.split('function packDimension',1)[1].split('function bioDimensions',1)[0]
    assert 'partitionCandidates(clean,k)' in pack
    assert 'partitionScore(a)-partitionScore(b)' in pack
    assert 'charWeight(line)<=BIO_ABSOLUTE_MAX' in pack
    assert 'charWeight(line)>=BIO_PREFERRED_MIN' in pack


def test_bio_short_assets_are_same_dimension_merged_not_forced_standalone():
    assert 'function packDimension(items,maxLines=3)' in POLICY
    assert "g.join('｜')" in POLICY
    assert 'function dimensionLines(profile,platform)' in POLICY
    assert 'packDimension(d.identity,3)' in POLICY
    assert 'packDimension(d.advantage,3)' in POLICY
    assert 'packDimension(d.value,3)' in POLICY


def test_bio_cancels_old_interest_honor_trait_quantity_caps():
    dims=POLICY.split('function bioDimensions',1)[1].split('function dimensionLines',1)[0]
    assert 'identity.push(...interests);' in dims
    assert 'advantage.push(...honors);' in dims
    assert 'advantage.push(...traits);' in dims
    assert 'interests.slice(' not in dims and 'honors.slice(' not in dims and 'traits.slice(' not in dims


def test_bio_semantic_dedupe_prefers_specific_quantified_fact():
    assert 'function bioSemanticFamily' in POLICY
    assert 'function bioFactStrength' in POLICY
    assert 'function dedupeBioFacts' in POLICY
    strength=POLICY.split('function bioFactStrength',1)[1].split('function dedupeBioFacts',1)[0]
    assert "score+=6" in strength and '长期|多年' in strength and 'score-=2' in strength
    dedupe=POLICY.split('function dedupeBioFacts',1)[1].split('function partitionCandidates',1)[0]
    assert 'bioFactStrength(raw)>bioFactStrength(out[index])' in dedupe


def test_bio_emoji_is_semantic_unique_and_summary_has_non_repeating_anchor():
    assert 'const BIO_EMOJIS=Object.freeze' in POLICY
    assert "'👤'" not in POLICY.split('const BIO_EMOJIS',1)[1].split('const KNOWN_INTERESTS',1)[0]
    assert 'function emojiCandidates(line,dimension)' in POLICY
    assert "if(/本科|硕士|博士|大专|985|211|QS|双一流|留学|海归/.test(v))return ['🎓'" in POLICY
    assert "if(/喝茶|茶|咖啡/.test(v))return ['☕'" in POLICY
    assert 'function pickBioEmoji(line,dimension,used)' in POLICY
    body=POLICY.split('function bioBody',1)[1].split('function explicitLicense',1)[0]
    assert 'used=new Set()' in body and 'pickBioEmoji(line,dimension,used)' in body
    build=POLICY.split('function buildBios',1)[1].split('function bioAssets',1)[0]
    assert 'used=new Set(body.map' in build and 'sloganEmoji=pickBioEmoji' in build


def test_bio_preserves_explicit_duration_precision_without_inventing_long_term():
    block=POLICY.split('function insuranceExperience',1)[1].split('const TRAIT_ALLOWED',1)[0]
    assert "raw.match(/\\d+(?:\\.\\d+)?/)" in block
    assert "/年多|\\+/.test(raw)?`${n}年+`:`${n}年`" in block
    assert "'多年保险行业经验'" in block
    assert "platform==='xhs'?'从业经历':'保险从业'" in block
    assert '长期保险行业经验' not in POLICY


def test_bio_interests_only_use_explicit_profile_or_self_intro_evidence():
    block=POLICY.split('function interestFacts',1)[1].split('function serviceFacts',1)[0]
    assert 'profile?.hobbies' in block and 'profile?.interests' in block
    assert 'KNOWN_INTERESTS.filter(v=>intro.includes(v))' in block
    assert 'secondaryTopics(profile)' not in block


def test_bio_does_not_invent_default_value_lines_to_fill_space():
    service=POLICY.split('function serviceFacts',1)[1].split('function headlineEvidenceText',1)[0]
    assert 'if(!evidence)return []' in service
    assert "['家庭保障','养老规划','保险知识']" not in POLICY.split('function bioDimensions',1)[1].split('function dimensionLines',1)[0]


def test_xhs_filters_sensitive_body_but_does_not_filter_rendered_text_after_core():
    dims=POLICY.split('function bioDimensions',1)[1].split('function dimensionLines',1)[0]
    assert "if(platform==='xhs')" in dims and 'XHS_BANNED.test(v)' in dims
    assert "return platform==='xhs'?`${years}从业经历`:`${years}保险从业经验`" in POLICY
    assert 'sanitizeBioBlocks' not in V10 and 'textarea.value=' not in V10
    assert "proposal.bios={xiaohongshu:buildBios(p,'xhs',slogan),videoDouyin:buildBios(p,'video',slogan)}" in POLICY


def test_missing_nickname_is_never_treated_as_keepable():
    assert 'const missing=' in V29 and '当前没有填写昵称' in V29
    assert "missing(rawVideo)?'':rawVideo" in V29 and '建议优先保留' in V29


def test_existing_nickname_audit_flags_special_symbols_emoji_and_full_english():
    assert 'cleanNickname=value=>window.aiaNicknamePolicyV1?.cleanNicknameDisplay' in V29
    assert '包含特殊符号、Emoji 或装饰标点' in V29
    assert '纯英文昵称对普通中文用户的记忆、输入和搜索成本较高' in V29


def test_floating_buttons_are_icons_only_and_visibility_has_one_page_truth_source():
    assert 'aia-ip-owner-profile-button' in FLOAT and 'aia-ip-owner-proposal-button' in FLOAT
    assert "makeButton(IDS.profileButton, '我的 IP 资料'" in FLOAT and "makeButton(IDS.proposalButton, 'IP 方案'" in FLOAT
    assert '最新 IP 方案 · V' not in FLOAT and 'state.activeTool' not in FLOAT
    assert 'function workspaceVisible()' in FLOAT and 'function sync()' in FLOAT
    assert 'actions.hidden = !visible' in FLOAT and 'proposalButton.hidden = !latestProposal()' in FLOAT
    assert "owner: 'web/profile-float.js'" in FLOAT and 'ownsProfileData: false' in FLOAT and 'independentDrawer: true' in FLOAT


def test_existing_nickname_audit_reuses_proposal_card_component():
    assert "card.className='proposal-card nickname-audit-card'" in V29


def test_personal_intro_is_not_removed_by_old_profile_layers():
    v8=(WEB/'product-rules-v8.js').read_text(encoding='utf-8')
    assert "if (label === '生成偏好') group.remove()" in v8
    assert "label === '个人介绍'" not in v8 and "label === '自我介绍'" not in v8


def test_compliance_ui_is_read_only_and_keeps_two_column_help():
    assert 'proposal.bios=' not in V10.replace(' ','')
    assert "['可以说',cfg.can" in V10 and "['不可以说',cfg.cannot" in V10
    assert "b.textContent='?'" in V10
    assert "card.classList.add('aia-compliance-help-host')" in V10 and 'card.appendChild(b)' in V10
    assert 'position:absolute!important' in V10 and 'right:16px' in V10 and 'top:16px' in V10
    assert "hs[0].textContent='小红书简介 · 推荐版'" in V10
    assert "hs[1].textContent='视频号 / 抖音简介 · 推荐版'" in V10
    assert 'textarea.value=' not in V10 and 'sanitizeBioBlocks' not in V10 and 'ownsBioText:false' in V10


def test_clipboard_success_has_one_owner():
    assert 'navigator.clipboard.writeText =' not in V22 and 'copyStateObserver' not in V22 and 'ownsClipboard:false' in V22
    assert 'writeClipboard' in V28 and "successLabel='复制成功'" in V28 and 'button.textContent=successLabel' in V28 and 'show(successLabel)' in V28
