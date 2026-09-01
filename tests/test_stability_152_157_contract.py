from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "web/index.html").read_text(encoding="utf-8")
ONBOARDING = (ROOT / "web/ip-onboarding-contract-v1.js").read_text(encoding="utf-8")
RUNTIME = (ROOT / "web/ip-runtime-contract-v1.js").read_text(encoding="utf-8")
CORE = (ROOT / "web/ip-policy-core.js").read_text(encoding="utf-8")
DEPLOY = (ROOT / ".github/workflows/deploy.yml").read_text(encoding="utf-8")
SCRIPT_SERVER = (ROOT / "script_server.py").read_text(encoding="utf-8")

EXPECTED_CITIES = [
    "北京","常州","成都","东莞","佛山","广州","杭州","合肥","淮安","惠州","济南","江门","揭阳","廊坊","泸州","茂名","梅州","南京","南通","清远","汕头","上海","韶关","深圳","石家庄","苏州","泰州","唐山","天津","无锡","武汉","襄阳","徐州","盐城","扬州","宜昌","湛江","肇庆","镇江","郑州","中山","重庆","珠海"
]

EXPECTED_QUESTION_KEYS = [
    "primaryGoal", "city", "insuranceYears", "strengths", "honors", "education",
    "schoolTier", "overseas", "contentTone", "previousCareer", "lifeRoles",
    "hobbies", "services", "department",
]


def test_152_city_options_are_complete_and_canonical():
    for city in EXPECTED_CITIES:
        assert f"'{city}'" in ONBOARDING
    assert "city.chips = [...CITY_OPTIONS]" in ONBOARDING


def test_157_question_contract_covers_all_core_profile_fields():
    for key in EXPECTED_QUESTION_KEYS:
        assert f"'{key}'" in ONBOARDING
    assert "customerGroups|recruitmentGroups" in ONBOARDING
    assert "customerAges|recruitmentAges" in ONBOARDING
    assert "key: 'previousCareer'" in ONBOARDING
    assert "key: 'lifeRoles'" in ONBOARDING
    assert "key: 'hobbies'" in ONBOARDING
    assert "key: 'services'" in ONBOARDING
    assert "education.chips = ['大专','本科','硕士','博士']" in ONBOARDING


def test_157_content_tone_is_required_when_missing_and_affects_rewrite():
    assert "这个选择会影响后续的脚本改写风格" in ONBOARDING
    assert "tone.multiple = true" in ONBOARDING
    assert "tone.collectIfMissing = true" in ONBOARDING
    assert "firstMissingIndex" in ONBOARDING
    assert "missingQuestionKeys" in ONBOARDING
    assert "state.done = false" in ONBOARDING


def test_onboarding_contract_loads_after_legacy_rule_layers():
    assert INDEX.index("product-rules-v29.js") < INDEX.index("ip-onboarding-contract-v1.js")
    assert INDEX.index("ip-policy-core.js") < INDEX.index("ip-runtime-contract-v1.js")


def test_153_new_proposals_are_canonicalized_before_reuse():
    assert "window.aiaIpPolicy?.enforceProposal" in RUNTIME
    assert "/api/proposal/canonical" in RUNTIME
    assert "save_canonical_proposal" in SCRIPT_SERVER
    assert 'path == "/api/proposal/canonical"' in SCRIPT_SERVER
    assert "headlineFallback" in CORE
    assert "cleanCareer&&interest" not in CORE
    assert "财务.*跑步" not in CORE


def test_154_peer_claims_only_come_from_real_repeated_peer_evidence():
    assert "function peerTraitFacts" in CORE
    assert "reviewCount<2" in CORE
    assert "Number(i?.count||0)>=2" in CORE
    assert "function ownTraitFacts" in CORE
    assert "else if(ownTraits.length)add('✨','个人优势'" in CORE
    assert "if(peerTraits.length)add('💬','他人评价'" in CORE
    assert "removeUnsupportedPeerClaims" in RUNTIME


def test_155_bio_prefers_12_20_but_can_use_real_short_facts_to_reach_three_lines():
    assert "BIO_PREFERRED_MIN=12" in CORE
    assert "BIO_PREFERRED_MAX=20" in CORE
    assert "BIO_ABSOLUTE_MAX=25" in CORE
    assert "BIO_RELAXED_MIN=6" in CORE
    assert "function packDimension" in CORE
    assert "function bioBody" in CORE
    assert "focus:'我是谁 + 我的优势 + 我能提供什么价值'" in CORE


def test_156_production_entrypoint_supports_script_recommendation():
    assert "script_server.py --port 8000" in DEPLOY
    assert 'path == "/api/scripts/recommend"' in SCRIPT_SERVER
    assert 'path == "/api/scripts/library"' in SCRIPT_SERVER
