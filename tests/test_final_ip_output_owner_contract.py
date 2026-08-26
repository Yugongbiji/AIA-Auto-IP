from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CORE=(ROOT/'web/ip-policy-core.js').read_text(encoding='utf-8')
NICK=(ROOT/'web/nickname-policy-v1.js').read_text(encoding='utf-8')
V10=(ROOT/'web/product-rules-v10.js').read_text(encoding='utf-8')
OWNER=(ROOT/'rules/product-rule-ownership.md').read_text(encoding='utf-8')


def test_final_ip_outputs_have_only_declared_runtime_owners():
    assert 'IP 方案定位类输出' in OWNER and '`web/ip-policy-core.js`' in OWNER
    assert '推荐昵称' in OWNER and '`web/nickname-policy-v1.js`' in OWNER
    assert '推荐简介正文' in OWNER and '`web/ip-policy-core.js`' in OWNER
    assert 'proposal.bios=' not in V10.replace(' ','')
    assert 'textarea.value=' not in V10
    assert 'sanitizeBioBlocks' not in V10


def test_headline_is_canonical_natural_slogan_not_field_wall():
    clean=CORE.split('function cleanHeadlineCandidate',1)[1].split('function headlineFallback',1)[0]
    assert "replace(/[｜|]+/g,'，')" in clean
    assert '是我的标签' in clean and '是我的专业底色' in clean
    assert '本科|硕士|博士|大专' in clean and 'MDRT|COT|TOT' in clean
    enforce=CORE.split('function enforceProposal',1)[1].split('function canonicalizeHistory',1)[0]
    assert 'proposal.headline=slogan' in enforce
    assert "buildBios(p,'xhs',slogan)" in enforce
    assert "buildBios(p,'video',slogan)" in enforce


def test_bio_is_single_recommendation_with_same_dimension_line_packing():
    assert 'function packDimension(items,maxLines=3)' in CORE
    dims=CORE.split('function bioDimensions',1)[1].split('function dimensionLines',1)[0]
    assert 'const identity=[]' in dims and 'advantage=[]' in dims and 'value=[]' in dims
    lines=CORE.split('function dimensionLines',1)[1].split('function bioBody',1)[0]
    assert 'packDimension(d.identity)' in lines
    assert 'packDimension(d.advantage)' in lines
    assert 'packDimension(d.value)' in lines
    assert 'const BIO_PREFERRED_MIN=12;' in CORE
    assert 'const BIO_PREFERRED_MAX=20;' in CORE
    assert 'const BIO_ABSOLUTE_MAX=25;' in CORE
    assert "focus:'我是谁 + 我的优势 + 我能提供什么价值'" in CORE


def test_bio_summary_uses_same_headline_with_emoji_and_fixed_footer():
    build=CORE.split('function buildBios',1)[1].split('function bioAssets',1)[0]
    assert 'slogan=text(headlineText)' in build
    assert 'BIO_EMOJIS[body.length%BIO_EMOJIS.length]' in build
    assert 'complianceFooter(profile,platform)' in build
    assert "const XHS_DISCLAIMER='本账号所述内容为个人意见，不代表任何官方意见。';" in CORE
    assert 'agentId' not in CORE.split('function complianceFooter',1)[1].split('function buildBios',1)[0]


def test_nickname_presets_keep_internal_priority_but_user_reason_is_product_value():
    assert "if(kind==='preset')score+=100" in NICK
    assert "angle:index===0?'首选推荐':'备选推荐'" in NICK
    assert 'function reasonFor' in NICK and 'function presetReason' in NICK
    assert '好记、好输入，也方便搜索' in NICK
    assert '产品负责人基于真实资料人工验收确认' not in NICK
    assert '优先于临时生成，仍保留 AI 补充路径' not in NICK


def test_nickname_controlled_routes_do_not_use_former_career_or_credentials():
    assert 'previousCareer' not in NICK
    assert 'function career(' not in NICK
    assert 'function educationAsset' not in NICK
    assert 'function achievementAsset' not in NICK
    assert 'function regionAsset' not in NICK
    assert 'distinctiveOptions(profile,a).forEach' in NICK
    assert "add(a,'突出人物'" in NICK
