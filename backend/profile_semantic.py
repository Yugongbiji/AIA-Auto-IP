from __future__ import annotations

import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ALLOWED_FIELDS = {
    "city",
    "customerGroups",
    "customerAges",
    "insuranceYears",
    "strengths",
    "honors",
    "education",
    "schoolTier",
    "overseas",
    "contentTone",
    "department",
    "previousCareer",
    "lifeRoles",
    "hobbies",
    "services",
}


def _clean(value):
    return str(value or "").strip()


def _fallback(profile: dict) -> dict:
    """Small deterministic fallback used only when the model is unavailable.

    This intentionally stays conservative: only explicit phrases are copied.
    """
    intro = _clean(profile.get("selfIntro"))
    if not intro:
        return {}
    updates = {}
    rules = {
        "previousCareer": [
            ("教师", "教师"), ("老师", "教师"), ("律师", "律师"), ("医生", "医生"),
            ("护士", "护士"), ("会计", "会计"), ("审计", "审计"), ("产品经理", "产品经理"),
            ("程序员", "程序员"), ("创业", "创业/企业经营"),
        ],
        "lifeRoles": [
            ("宝妈", "宝妈"), ("孩子的妈妈", "宝妈"), ("宝爸", "宝爸"),
            ("孩子的爸爸", "宝爸"), ("企业主", "企业主"), ("创业者", "创业者"),
        ],
        "hobbies": [
            ("骑行", "骑行"), ("跑步", "跑步"), ("马拉松", "跑步"), ("旅行", "旅行"),
            ("旅游", "旅行"), ("摄影", "摄影"), ("阅读", "阅读"), ("读书", "阅读"),
            ("健身", "健身"), ("瑜伽", "瑜伽"), ("羽毛球", "羽毛球"), ("网球", "网球"),
        ],
    }
    for field, pairs in rules.items():
        if _clean(profile.get(field)):
            continue
        values = []
        for needle, label in pairs:
            if needle in intro and label not in values:
                values.append(label)
        if values:
            updates[field] = "｜".join(values)
    return updates


def analyze(profile: dict) -> dict:
    """Extract only facts explicitly stated in the self introduction.

    Existing non-empty fields are never overwritten. The model is instructed to
    return an empty value when evidence is not explicit, so downstream questions
    are skipped only when the information is actually present in the source text.
    """
    profile = profile if isinstance(profile, dict) else {}
    intro = _clean(profile.get("selfIntro"))
    if not intro:
        return {"updates": {}, "source": "none"}

    api_key = _clean(os.getenv("DEEPSEEK_API_KEY"))
    if not api_key:
        return {"updates": _fallback(profile), "source": "fallback"}

    missing = [key for key in sorted(ALLOWED_FIELDS) if not _clean(profile.get(key))]
    if not missing:
        return {"updates": {}, "source": "already-complete"}

    system_prompt = """你负责从营销员已经填写的中文自我介绍中提取明确事实，用于避免后续重复提问。
只允许提取原文明确说出的信息，禁止推测、补全、常识联想或根据职业猜测客户类型。
如果原文没有明确证据，对应字段必须为空。
已有字段由调用方保护，不需要重复输出。

可提取字段含义：
city=明确服务/所在城市；customerGroups=明确说希望/主要服务的人群；customerAges=明确客户年龄段；insuranceYears=明确保险从业年数；strengths=明确自述的优势/性格；honors=明确荣誉；education=明确最高学历；schoolTier=明确985/211/QS等学校背景；overseas=明确留学经历；contentTone=明确希望账号呈现的表达气质；department=明确营销服务部；previousCareer=过往职业/行业；lifeRoles=家庭或生活身份；hobbies=明确兴趣爱好；services=明确可以提供或擅长的服务。

多项内容用“｜”连接。不要把营销话术改写成新事实。
只输出合法 JSON：{"updates":{"字段":"值"},"evidence":{"字段":"对应的原文短语"}}。"""
    payload = {
        "model": os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash"),
        "thinking": {"type": "disabled"},
        "max_tokens": 900,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps({"missingFields": missing, "selfIntro": intro}, ensure_ascii=False)},
        ],
    }
    request = Request(
        "https://api.deepseek.com/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=35) as response:
            body = json.loads(response.read().decode("utf-8"))
        result = json.loads(body.get("choices", [{}])[0].get("message", {}).get("content", "{}"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, KeyError, TypeError):
        return {"updates": _fallback(profile), "source": "fallback"}

    raw_updates = result.get("updates") if isinstance(result, dict) and isinstance(result.get("updates"), dict) else {}
    evidence = result.get("evidence") if isinstance(result, dict) and isinstance(result.get("evidence"), dict) else {}
    updates = {}
    safe_evidence = {}
    for key, value in raw_updates.items():
        value = _clean(value)
        if key not in ALLOWED_FIELDS or key not in missing or not value:
            continue
        proof = _clean(evidence.get(key))
        if not proof or proof not in intro:
            # Be conservative when the model cannot point back to source text.
            continue
        updates[key] = value
        safe_evidence[key] = proof
    return {"updates": updates, "evidence": safe_evidence, "source": "semantic"}
