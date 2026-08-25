from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NICK = (ROOT / 'web' / 'nickname-policy-v1.js').read_text(encoding='utf-8')
Q = (ROOT / 'web' / 'product-rules-v13.js').read_text(encoding='utf-8')


def test_129_preset_nickname_reason_is_user_facing_not_internal_governance():
    assert "function presetReason" in NICK
    assert "reason:presetReason(name,profile)" in NICK.replace(' ', '')
    assert "angle:index===0?'首选推荐':'备选推荐'" in NICK.replace(' ', '')
    assert '已由产品负责人基于真实资料人工验收确认' not in NICK
    assert '优先于临时生成，仍保留 AI 补充路径' not in NICK
    for phrase in ['人物锚点', '记忆点', '网感', '好记也方便搜索']:
        assert phrase in NICK


def test_133_school_background_has_complete_quality_options():
    compact = Q.replace(' ', '')
    for option in ['985', '211', '双一流', 'QS前100', '都不是']:
        assert option in compact
    assert "schoolQuestion.collectIfMissing=true" in compact


def test_136_content_tone_restores_full_style_library_and_max_two_feedback():
    for option in ['专业理性', '亲和温暖', '风趣幽默', '干练直接', '犀利直接', '生活化真诚', '观点鲜明', '沉稳可信', '轻松有梗']:
        assert option in Q
    compact = Q.replace(' ', '')
    assert "styleQuestion.multiple=true" in compact
    assert "styleQuestion.maxSelections=2" in compact
    assert '这个风格最多选 2 个' in Q
    assert "contentToneMaxSelections:2" in compact
    assert "button.textContent.trim()!=='添加'" in compact
