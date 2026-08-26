from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NICK = (ROOT / 'web' / 'nickname-policy-v1.js').read_text(encoding='utf-8')
CORE = (ROOT / 'web' / 'ip-policy-core.js').read_text(encoding='utf-8')
NICK_RULES = (ROOT / 'rules' / 'nickname-naturalness-rules-20260825.md').read_text(encoding='utf-8')
BIO_RULES = (ROOT / 'docs' / '简介受控词库与模板-V1-20260824.md').read_text(encoding='utf-8')


def test_138_existing_nickname_removes_decorative_symbols_before_recommendation():
    assert '洢萱卍 → 洢萱' in NICK_RULES
    assert '新生成昵称默认不使用 Emoji、特殊符号' in NICK_RULES
    assert 'function cleanNicknameDisplay' in NICK
    assert 'DECORATIVE_SYMBOLS' in NICK
    assert '卍' in NICK and '卐' in NICK
    assert '.map(cleanNicknameDisplay)' in NICK
    assert 'normalizeSearchable(name){return cleanNicknameDisplay(name)' in NICK


def test_139_bio_emoji_is_semantic_not_positional_only():
    assert 'Emoji 应与该行内容尽量自然匹配' in BIO_RULES
    assert '正文默认至少 3 行' in BIO_RULES
    assert 'function emojiCandidates' in CORE
    assert 'function pickBioEmoji' in CORE
    assert "return ['🎓','📚','🌟']" in CORE
    assert "return ['🏅','🌟','✨']" in CORE
    assert "return ['☕','🌿','✨']" in CORE
    assert "return ['🧭','🎯','💡']" in CORE
    assert "rows=[...groups.identity.map(line=>({dimension:'identity',line}))" in CORE


def test_139_bio_reads_explicit_strengths_and_does_not_invent_long_term_interest():
    assert 'split(profile?.strengths)' in CORE
    assert 'split(profile?.traits)' in CORE
    assert 'split(profile?.personality)' in CORE
    headline = CORE.split('function headlineFallback', 1)[1].split('function headline(profile', 1)[0]
    assert '长期喜欢${interest}' not in headline
    assert 'honor&&interest' in headline
