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
        assert 'proposal.bios=' not in source.replace(' ','')
        assert 'proposal.contentMainline=' not in source.replace(' ','')
    assert 'ownsBusinessRules: false' in V12 and 'ownsBusinessRules: false' in V13
    assert 'ownsNicknameOptions:false' in V19 and 'ownsNicknameOptions:false' in V29


def test_goal_is_binary_and_ambiguous_purpose_requires_clarification():
    assert 'customer_acquisition' in POLICY and 'recruitment' in POLICY
    assert 'if (recruit && !customer' in POLICY and 'if (customer && !recruit' in POLICY
    assert 'delete profile.primaryGoal' in POLICY
    assert '吸引潜在客户' in POLICY and '吸引潜在增员对象' in POLICY
    assert 'questions.splice(oldPurposeIndex, 1)' in POLICY


def test_skip_and_other_options_are_removed_centrally():
    assert 'const OMIT = /^(其他|其它|不希望填写|跳过' in POLICY and 'cleanQuestionOptions' in POLICY
    assert "['大专', '本科', '硕士', '博士']" in V13


def test_lifestyle_topics_can_only_be_secondary():
    for topic in ['健康养生','美食','读书','旅行','智能家居','骑行','育儿']: assert topic in POLICY
    customer_block=POLICY.split('const CUSTOMER_MAINLINES',1)[1].split('const RECRUITMENT_MAINLINES',1)[0]
    for forbidden in ['健康养生','美食','读书','旅行','智能家居','骑行','育儿']: assert forbidden not in customer_block
    assert 'return [...RECRUITMENT_MAINLINES]' in POLICY and 'rankIpContentBranches' in POLICY


def test_headline_does_not_use_person_name_anchor():
    block=POLICY.split('function headline(profile',1)[1].split('function subheadline',1)[0]
    assert 'cleanHeadlineCandidate' in POLICY and 'headlineFallback' in POLICY
    assert 'preferredName' not in block and 'profile?.name' not in block


def test_headline_103_is_one_slogan_owner_without_vertical_separator_and_is_reused_in_bios():
    assert "function headline(profile,candidate='')" in POLICY
    clean=POLICY.split('function cleanHeadlineCandidate',1)[1].split('function headlineFallback',1)[0]
    assert "replace(/[｜|]+/g,'，')" in clean
    assert 'XHS_BANNED.test(v)' in clean
    assert 'numbers.some' in clean and '0人脉' in clean and '擅长' in clean
    build=POLICY.split('function buildBios(profile,platform,headlineText)',1)[1].split('function enforceProposal',1)[0]
    assert 'const slogan=text(headlineText);const body=bioBody(profile,platform);' in build
    assert 'const sloganLine=slogan?emojiLine(BIO_EMOJIS[body.length % BIO_EMOJIS.length],slogan)' in build
    assert 'lines:[...body,...(sloganLine?[sloganLine]:[]),...complianceFooter(profile,platform)]' in build
    enforce=POLICY.split('function enforceProposal(proposal,profile)',1)[1].split('function canonicalizeHistory',1)[0]
    assert 'const slogan=headline(p,proposal?.headline)' in enforce
    assert 'proposal.headline=slogan' in enforce
    assert "buildBios(p,'xhs',slogan)" in enforce and "buildBios(p,'video',slogan)" in enforce


def test_bio_has_single_compliance_footer_owner_and_exact_fixed_copy():
    assert 'function complianceFooter(profile,platform)' in POLICY
    assert "const VIDEO_DISCLAIMER='本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见';" in POLICY
    assert "const XHS_DISCLAIMER='本账号所述内容为个人意见，不代表任何官方意见。';" in POLICY
    footer=POLICY.split('function complianceFooter(profile,platform)',1)[1].split('function buildBios',1)[0]
    assert "return [VIDEO_DISCLAIMER,`营销服务部：${department||'待补充'}`,`执业证编号：${license||'待补充'}`]" in footer
    assert "if(platform==='xhs') return [XHS_DISCLAIMER]" in footer
    assert "'000'" not in footer and 'agentId' not in footer and 'agent_id' not in footer


def test_bio_outputs_one_recommendation_per_platform_and_three_semantic_dimensions():
    assert '小红书简介 · 推荐版' in POLICY and '视频号 / 抖音简介 · 推荐版' in POLICY
    assert "return [{label,focus:'我是谁 + 我的优势 + 我能提供什么价值'" in POLICY
    assert 'groups.identity' in POLICY and 'groups.advantage' in POLICY and 'groups.value' in POLICY
    assert '方案 A · 专业背书' not in POLICY and '方案 B · 人设记忆' not in POLICY and '方案 C · 价值服务' not in POLICY


def test_bio_uses_strict_career_evidence_and_does_not_upgrade_generic_law_keyword():
    assert 'function bioCareerFacts(profile)' in POLICY and 'BIO_GENERIC_DOMAINS' in POLICY
    assert '法律|教育|金融|医疗' in POLICY and 'BIO_CAREER_SIGNAL' in POLICY
    assert '曾从事${job}' not in POLICY.split('const XHS_BANNED',1)[1] and '客户比较常提到我' not in POLICY


def test_bio_layout_has_12_20_preferred_range_and_25_absolute_cap():
    assert 'const BIO_PREFERRED_MIN=12;' in POLICY and 'const BIO_PREFERRED_MAX=20;' in POLICY and 'const BIO_ABSOLUTE_MAX=25;' in POLICY
    assert 'charWeight(candidate)>BIO_PREFERRED_MAX' in POLICY and 'charWeight(merged)<=BIO_ABSOLUTE_MAX' in POLICY
    assert 'charWeight(line)<=BIO_ABSOLUTE_MAX' in POLICY and 'function rebalanceBioLines(lines)' in POLICY


def test_bio_short_assets_are_merged_instead_of_forced_to_standalone_lines():
    assert 'function packBioItems(items,maxLines=3)' in POLICY and "`${current}｜${item}`" in POLICY
    assert 'if(charWeight(lines[i])>=BIO_PREFERRED_MIN)continue' in POLICY
    assert 'packed.filter(line=>charWeight(line)>=BIO_PREFERRED_MIN)' in POLICY
    assert "type:'identity'" in POLICY and "type:'advantage'" in POLICY and "type:'value'" in POLICY
    assert 'services.slice(0,4)' not in POLICY


def test_bio_emoji_is_unique_by_line_and_person_icon_is_retired():
    assert 'const BIO_EMOJIS=Object.freeze' in POLICY
    bio_block=POLICY.split('function bioBody(profile,platform)',1)[1].split('function explicitLicense',1)[0]
    assert 'BIO_EMOJIS[index % BIO_EMOJIS.length]' in bio_block and "emojiLine('👤'" not in bio_block
    assert "'👤'" not in POLICY.split('const BIO_EMOJIS',1)[1].split('function safeXhs',1)[0]


def test_bio_prefers_specific_quantified_fact_over_vague_same_family_summary():
    assert 'function bioSemanticFamily(value)' in POLICY and 'function bioFactStrength(value)' in POLICY
    assert "[/财务|会计/,'财务']" in POLICY
    assert "if(/\\d+(?:\\.\\d+)?\\s*年|\\d+\\+/.test(v))score+=6" in POLICY
    assert "if(/长期|多年/.test(v)&&!/\\d/.test(v))score-=2" in POLICY
    assert 'bioFactStrength(asset.value)>bioFactStrength(pool[idx].value)' in POLICY


def test_bio_preserves_time_precision_and_never_invents_vague_duration():
    block=POLICY.split('function bioInsuranceExperience(profile)',1)[1].split('function bioTraitFacts',1)[0]
    assert "replace(/年多$/,'年+')" in block and "return `${raw}保险从业经验`" in block
    assert "if(/多年/.test(raw))return '多年保险行业经验'" in block and "return '保险从业'" in block
    assert '长期保险行业经验' not in POLICY


def test_bio_does_not_invent_default_value_lines_just_to_reach_three_lines():
    service_block=POLICY.split('function bioServiceFacts(profile,platform)',1)[1].split('function bioInterestFacts',1)[0]
    dimension_block=POLICY.split('function dimensionLines',1)[1].split('function dedupeBioLines',1)[0]
    assert "if(!evidence)return []" in service_block
    assert "['职业选择','转型成长'" not in service_block
    assert "['家庭保障','养老规划','保险知识']" not in dimension_block
    assert "['家庭生活','长期规划','个人成长']" not in dimension_block


def test_bio_102_platform_difference_is_only_explicit_xhs_compliance_and_footer():
    service_block=POLICY.split('function bioServiceFacts(profile,platform)',1)[1].split('function bioInterestFacts',1)[0]
    body_block=POLICY.split('function bioBody(profile,platform)',1)[1].split('function explicitLicense',1)[0]
    assert "if(platform==='xhs')values=values.filter(safeXhs)" in service_block
    assert "if(platform==='xhs')lines=lines.filter" in body_block and 'safeXhs' in body_block
    for forbidden in ['slice(0,2)','slice(0,3)','platform===\'xhs\'?2','platform===\'xhs\'?3']:
        assert forbidden not in body_block
    assert "proposal.bios.xiaohongshu=buildBios(p,'xhs',slogan)" in POLICY
    assert "proposal.bios.videoDouyin=buildBios(p,'video',slogan)" in POLICY


def test_missing_nickname_is_never_treated_as_keepable():
    assert 'const missing=' in V29 and '当前没有填写昵称' in V29 and "missing(rawVideo)?'':rawVideo" in V29 and '建议优先保留' in V29


def test_floating_buttons_are_icons_only_and_visibility_has_one_page_truth_source():
    assert '<svg aria-hidden="true"' in FLOAT and 'profileButton.innerHTML' in FLOAT and 'proposalButton.innerHTML' in FLOAT
    assert '最新 IP 方案 · V' not in FLOAT and "querySelector('span:last-child')" not in FLOAT and "state.activeTool==='ip'" not in FLOAT
    assert 'isIpConversationVisible' in FLOAT and 'ownsProfileData:false' in FLOAT
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
