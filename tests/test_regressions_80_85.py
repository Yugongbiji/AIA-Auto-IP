from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'web'

NAV = (WEB / 'script-recommendation-navigation-fix.js').read_text(encoding='utf-8')
RECOMMEND = (WEB / 'script-recommendation-v1.js').read_text(encoding='utf-8')
CONTENT_VIEW = (WEB / 'product-rules-v20.js').read_text(encoding='utf-8')
DETAIL_PAGING = (WEB / 'product-rules-v17.js').read_text(encoding='utf-8')
CORE = (WEB / 'ip-policy-core.js').read_text(encoding='utf-8')
COMPLIANCE_UI = (WEB / 'product-rules-v10.js').read_text(encoding='utf-8')
INDEX = (WEB / 'index.html').read_text(encoding='utf-8')
STYLES = (WEB / 'styles.css').read_text(encoding='utf-8')
FLOAT = (WEB / 'profile-float.js').read_text(encoding='utf-8')


def test_retired_v33_cannot_reenter_runtime_load_chain():
    assert 'product-integration-v33.js' not in INDEX
    assert 'product-integration-v33.js' not in NAV
    assert 'data-aia-v33' not in NAV
    assert "script.src='product-integration-v33.js'" not in NAV.replace(' ', '')


def test_script_recommendation_reads_canonical_ip_directions():
    assert 'buildIpContentStrategy' not in RECOMMEND
    assert 'contentMainline' in RECOMMEND
    assert 'secondaryContent' in RECOMMEND
    assert 'SCRIPT_DIRECTION_ALIASES' in RECOMMEND
    assert "scriptApiUrl('recommend')" in RECOMMEND
    assert 'library?' in RECOMMEND
    assert '完成 IP 人设，推荐会更懂你' in RECOMMEND


def test_content_direction_view_keeps_information_density():
    assert '内容方向' in CONTENT_VIEW
    assert '合集推荐' in CONTENT_VIEW
    assert '对账号的作用' in CONTENT_VIEW
    assert '内容聚焦提醒' in CONTENT_VIEW
    assert 'contentMainline' in CONTENT_VIEW
    assert 'secondaryContent' in CONTENT_VIEW
    assert 'ownsBusinessRules:false' in CONTENT_VIEW


def test_collection_recommendations_use_book_title_marks():
    compact = CONTENT_VIEW.replace(' ', '')
    assert '`《${name}》`' in CONTENT_VIEW
    assert 'collectionNames(values)' in CONTENT_VIEW
    assert "block('合集推荐',collectionNames(values),'strategy-collection-chip')" in compact


def test_bio_visual_anchors_and_single_platform_recommendations_live_in_canonical_owner():
    assert 'const BIO_EMOJIS=Object.freeze' in CORE
    emoji_block = CORE.split('const BIO_EMOJIS', 1)[1].split('function safeXhs', 1)[0]
    assert "'👤'" not in emoji_block
    assert 'function bioBody(profile,platform)' in CORE
    assert 'function complianceFooter(profile,platform)' in CORE
    assert "小红书简介 · 推荐版" in CORE
    assert "视频号 / 抖音简介 · 推荐版" in CORE
    assert "方案 A · 专业背书" not in CORE
    assert 'proposal.bios.xiaohongshu=buildBios' in CORE.replace(' ', '')
    assert 'proposal.bios.videoDouyin=buildBios' in CORE.replace(' ', '')


def test_compliance_help_keeps_question_mark_in_card_top_right():
    compact = COMPLIANCE_UI.replace(' ', '')
    assert "b.textContent='?'" in COMPLIANCE_UI
    assert "heading.closest('section,article,.proposal-card,.proposal-block')" in COMPLIANCE_UI
    assert "host.appendChild(b)" in compact
    assert 'position:absolute' in COMPLIANCE_UI and 'right:14px' in COMPLIANCE_UI and 'top:14px' in COMPLIANCE_UI
    assert '查看昵称合规提示' in COMPLIANCE_UI
    assert '查看简介合规提示' in COMPLIANCE_UI


def test_proposal_layout_contract_remains_vertical_for_nickname_and_sections():
    compact = STYLES.replace(' ', '').replace('\n', '')
    assert '.proposal-content{display:flex;flex-direction:column' in compact
    assert '.proposal-grid{display:grid;grid-template-columns:1fr' in compact
    assert '.nickname-list{display:grid' in compact
    assert '.nickname-option{display:flex' in compact


def test_floating_profile_entry_is_dom_driven_and_still_owned():
    assert 'ip-floating-profile-button' in FLOAT
    assert 'profileButton.innerHTML' in FLOAT
    assert "state.activeTool==='ip'" not in FLOAT
    assert "!chat.classList.contains('hidden')" in FLOAT
    assert 'syncVisibility' in FLOAT
    assert 'ownsProfileData:false' in FLOAT


def test_script_detail_paging_resets_scroll_to_top():
    compact = DETAIL_PAGING.replace(' ', '')
    assert 'function resetDetailScroll()' in DETAIL_PAGING
    assert "detailScreen.scrollTo({top:0,left:0,behavior:'auto'})" in compact
    assert 'resetDetailScroll();' in DETAIL_PAGING
    assert 'requestAnimationFrame(resetDetailScroll)' in DETAIL_PAGING
