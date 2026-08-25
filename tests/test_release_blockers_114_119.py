from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = (ROOT / "web" / "ip-policy-core.js").read_text(encoding="utf-8")
V10 = (ROOT / "web" / "product-rules-v10.js").read_text(encoding="utf-8")
FLOAT = (ROOT / "web" / "profile-float.js").read_text(encoding="utf-8")
V29 = (ROOT / "web" / "product-rules-v29.js").read_text(encoding="utf-8")
RULES = (ROOT / "rules" / "ip-headline-slogan-rules.md").read_text(encoding="utf-8")


def test_114_ip_conversation_restores_floating_profile_entry():
    assert "function isIpConversationVisible" in FLOAT
    assert "queueMicrotask(syncVisibility)" in FLOAT
    assert "setTimeout(syncVisibility" in FLOAT


def test_115_existing_nickname_advice_reuses_proposal_card_component():
    assert "proposal-card nickname-audit-card" in V29


def test_116_tiny_bio_asset_cannot_occupy_a_line_alone():
    block = CORE.split("function packBioItems", 1)[1].split("function rebalanceBioLines", 1)[0]
    assert "packed.filter(line=>charWeight(line)>=BIO_PREFERRED_MIN)" in block


def test_117_summary_line_gets_next_non_repeating_emoji():
    block = CORE.split("function buildBios", 1)[1].split("function enforceProposal", 1)[0]
    assert "const body=bioBody(profile,platform)" in block
    assert "BIO_EMOJIS[body.length % BIO_EMOJIS.length]" in block
    assert "sloganLine" in block


def test_118_compliance_help_keeps_question_mark_affordance():
    assert "b.textContent='?'" in V10
    assert "查看昵称合规提示" in V10
    assert "查看简介合规提示" in V10
    assert "width:28px" in V10 and "border-radius:50%" in V10


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
