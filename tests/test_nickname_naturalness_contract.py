from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_104_no_single_character_name_slicing_without_evidence():
    owner = read("web/nickname-policy-v1.js")
    rules = read("rules/nickname-naturalness-rules-20260825.md")
    assert "张三 → 三" in rules
    assert "王一 → 一" in rules
    assert "if(n.length===2)out.push(n.slice(1))" not in owner
    assert "if(n.length>=3)out.push(n.slice(-2))" in owner
    assert "filter(x=>x.length>=2)" in owner


def test_105_peer_feedback_is_top_nickname_anchor_source():
    owner = read("web/nickname-policy-v1.js")
    rules = read("rules/nickname-naturalness-rules-20260825.md")
    peer = owner.index("...peerAnchors(p)")
    preferred = owner.index("...preferredAnchors(p)")
    existing = owner.index("...existingPersonAnchors(p)")
    natural = owner.index("...naturalNameAnchors(p)")
    assert -1 not in (peer, preferred, existing, natural)
    assert peer < preferred < existing < natural
    assert "客户/身边人反馈中的高频真实称呼" in rules
    assert "高频评价" in rules
    assert "他人角色认知" in rules


def test_106_nickname_candidates_have_naturalness_gate():
    owner = read("web/nickname-policy-v1.js")
    rules = read("rules/nickname-naturalness-rules-20260825.md")
    assert "function awkward" in owner
    assert "王一的一一世界" in rules
    assert "yana打网球" in rules
    assert "n.includes(full)&&n.includes(anchor)" in owner
    assert "(打|跑|去|做|学|玩|吃|喝|逛)" in owner
    assert "awkward(name,profile,a" in owner
    assert "awkward(name,profile,anchor)" in owner


def test_107_generic_suffixes_are_not_default_generated_routes():
    owner = read("web/nickname-policy-v1.js")
    rules = read("rules/nickname-naturalness-rules-20260825.md")
    assert "GENERIC_SUFFIXES" in owner
    assert "'的小世界'" in owner
    assert "'聊生活'" in owner
    assert "'看世界'" in owner
    assert "已有好昵称不机械改造" in rules
    assert "宁缺毋滥" in rules
    assert "'美食':'生活'" not in owner
    assert "goal==='recruitment'" not in owner


def test_existing_good_nickname_can_survive_generic_template_gate():
    owner = read("web/nickname-policy-v1.js")
    assert "{existing:true" in owner
    assert "if(!existing&&GENERIC_SUFFIXES.some" in owner


def test_nickname_reason_is_deterministic_owner_copy_not_free_deepseek_copy():
    owner = read("web/nickname-policy-v1.js")
    rules = read("rules/nickname-naturalness-rules-20260825.md")
    assert "优先保护已有用户记忆" in owner
    assert "优先使用客户/身边人真实称呼作为人物锚点" in owner
    assert "不得让 DeepSeek 每次自由编写不同风格的保留理由" in rules


def test_108_former_career_is_not_a_nickname_generation_route():
    owner = read("web/nickname-policy-v1.js")
    rules = read("rules/nickname-naturalness-rules-20260825.md")
    assert "过往职业只进入简介、不进入推荐昵称" in owner
    assert "function career(" not in owner
    assert "const job=career(profile)" not in owner
    assert "过往职业只能用于简介、IP 一句话定位" in rules
    assert "地产人成涛" in rules
    assert "财务人宋雨阳" in rules
    assert "前广告人张蕊" in rules


def test_109_simple_person_name_routes_are_capped_and_not_filled_with_aliases():
    owner = read("web/nickname-policy-v1.js")
    rules = read("rules/nickname-naturalness-rules-20260825.md")
    assert "纯姓名、真实称呼及其极简变体合计最多 **2 个**" in rules
    assert "这里只生成一个核心人物称呼型候选" in owner
    assert "已有好昵称最多再占一个名额" in owner
    assert "郭局 / 东哥 / 郭老师 / 郭旭东" in rules
    assert "宁可只推荐 2–3 个" in rules


def test_111_distinctive_current_traits_rank_before_plain_name():
    owner = read("web/nickname-policy-v1.js")
    rules = read("rules/nickname-naturalness-rules-20260825.md")
    prompt = read("prompts/ip-persona-prompt.md")
    assert "首选优先有记忆点、有网感" in rules
    assert "八块腹肌刘畅" in rules
    assert "飞行员刘畅" in rules
    assert "function distinctiveOptions" in owner
    assert "distinctiveOptions(profile,a).forEach" in owner
    assert owner.index("distinctiveOptions(profile,a).forEach") < owner.index("add(a,'突出人物'")
    assert "已有且有特色的好昵称" in prompt
    assert "单独本名" in prompt
    assert "过往职业" in prompt


def test_112_memorable_supported_descriptor_ranks_before_bare_anchor():
    owner = read("web/nickname-policy-v1.js")
    rules = read("rules/nickname-naturalness-rules-20260825.md")
    prompt = read("prompts/ip-persona-prompt.md")
    assert "有料有趣的流火" in rules
    assert "function memorablePeerDescriptor" in owner
    assert "function descriptorOptions" in owner
    assert "descriptorOptions(profile,a).forEach" in owner
    assert owner.index("descriptorOptions(profile,a).forEach") < owner.index("add(a,'突出人物'")
    assert "有证据的鲜明修饰语可以优先于裸称呼" in prompt
    assert "靠谱 / 专业 / 真诚" in rules


def test_113_full_english_symbols_and_emoji_are_deprioritized_or_filtered():
    owner = read("web/nickname-policy-v1.js")
    rules = read("rules/nickname-naturalness-rules-20260825.md")
    prompt = read("prompts/ip-persona-prompt.md")
    assert "中文可记忆、可搜索优先" in rules
    assert "TotoroFelix" in rules
    assert "兔子Nici" in rules
    assert "特殊符号" in rules
    assert "Emoji" in rules
    assert "function normalizeSearchable" in owner
    assert "function fullEnglish" in owner
    assert "if(fullEnglish(n)||!hasChinese(n))return '';" in owner
    assert "replace(/[^\\u4e00-\\u9fa5A-Za-z0-9]/g,'')" in owner
    assert "全英文昵称原则上不作为首选" in prompt
    assert "特殊符号" in prompt
    assert "Emoji" in prompt


def test_114_stranger_memory_priority_beats_plain_anchor_when_evidence_exists():
    owner = read("web/nickname-policy-v1.js")
    rules = read("rules/nickname-naturalness-rules-20260825.md")
    prompt = read("prompts/ip-persona-prompt.md")
    assert "#114 陌生人记忆点优先" in rules
    assert "真实称呼是人物锚点，不是默认首选" in rules
    assert "Nickname Memory Score" in rules
    assert "function memoryScore" in owner
    assert "function rankByMemory" in owner
    assert "memoryKind:'distinctive'" in owner
    assert "memoryKind:'descriptor'" in owner
    assert "return rankByMemory(candidates,profile,a,existing).slice(0,5);" in owner
    assert "proposal.nicknameOptions=rankByMemory(controlled,p,a,existing).slice(0,5);" in owner
    assert "纪录片迷" in owner
    assert "手帐控" in owner
    assert "真实称呼是素材，不是最终答案" in prompt
    assert "DeepSeek 不拥有首选排序权" in prompt
    assert "裸称呼/本名才允许成为首选" in prompt


def test_approved_preset_reads_primary_then_alternatives_and_keeps_legacy_candidates_fallback():
    owner = read("web/nickname-policy-v1.js")
    assert "Array.isArray(preset.alternatives)?preset.alternatives" in owner
    assert "Array.isArray(preset.candidates)?preset.candidates" in owner
    assert "const names=uniq([t(preset.primary),...alternatives.map(t)])" in owner
    assert "if(kind==='preset')score+=100" in owner
    assert "const allowAi=p.nicknamePreset?.allowAiFallback!==false" in owner
