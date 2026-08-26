from __future__ import annotations

import json
import os
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ALLOWED_FIELDS = {
    "city", "customerGroups", "customerAges", "recruitmentGroups", "recruitmentAges",
    "insuranceYears", "strengths", "honors", "education", "schoolTier", "overseas",
    "contentTone", "department", "previousCareer", "lifeRoles", "hobbies", "services",
}


def _clean(value):
    return str(value or "").strip()


def _goal(profile: dict) -> str:
    value = _clean(profile.get("primaryGoal"))
    if value in {"recruitment", "customer_acquisition"}:
        return value
    return ""


def _explicit_career_context(value: str) -> bool:
    """A career fact needs explicit work/identity context; a bare domain word is not enough."""
    text = _clean(value)
    if not text:
        return False
    if re.search(r"曾任|曾做|做过|从事|任职|工作|职业|以前|过去|原来|此前|本职", text):
        return True
    if re.search(r"\d+(?:\.\d+)?\s*年.{0,12}(?:经验|经历)", text):
        return True
    if re.search(r"我是.{0,10}(?:教师|老师|医生|护士|律师|法务|会计|审计|财务|税务|产品经理|程序员|工程师)", text):
        return True
    return False


def _fallback(profile: dict) -> dict:
    """Conservative deterministic fallback: only explicit non-audience facts."""
    intro = _clean(profile.get("selfIntro"))
    if not intro:
        return {}
    updates = {}
    rules = {
        "previousCareer": [
            ("教师", "教师"), ("老师", "教师"), ("律师", "律师"), ("医生", "医生"),
            ("护士", "护士"), ("会计", "会计"), ("审计", "审计"), ("财务", "财务"),
            ("税务", "税务"), ("产品经理", "产品经理"), ("程序员", "程序员"),
            ("工程师", "工程师"), ("创业", "创业/企业经营"),
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
        if field == "previousCareer" and not _explicit_career_context(intro):
            continue
        values = []
        for needle, label in pairs:
            if needle in intro and label not in values:
                values.append(label)
        if values:
            updates[field] = "｜".join(values)
    return updates


def analyze(profile: dict) -> dict:
    """Extract explicit facts from self intro without confusing customer vs recruitment audiences."""
    profile = profile if isinstance(profile, dict) else {}
    intro = _clean(profile.get("selfIntro"))
    if not intro:
        return {"updates": {}, "source": "none"}

    goal = _goal(profile)
    allowed = set(ALLOWED_FIELDS)
    if goal == "recruitment":
        allowed -= {"customerGroups", "customerAges"}
    elif goal == "customer_acquisition":
        allowed -= {"recruitmentGroups", "recruitmentAges"}
    else:
        # Until the binary goal is confirmed, do not prefill either audience family.
        allowed -= {"customerGroups", "customerAges", "recruitmentGroups", "recruitmentAges"}

    api_key = _clean(os.getenv("DEEPSEEK_API_KEY"))
    if not api_key:
        return {"updates": _fallback(profile), "source": "fallback"}

    missing = [key for key in sorted(allowed) if not _clean(profile.get(key))]
    if not missing:
        return {"updates": {}, "source": "already-complete"}

    system_prompt = """你负责从营销员已经填写的中文自我介绍中提取明确事实，用于避免后续重复提问。
只允许提取原文明确说出的信息，禁止推测、补全、常识联想或根据职业猜测客户类型。
如果原文没有明确证据，对应字段必须为空。已有字段由调用方保护，不需要重复输出。

特别注意当前账号目标：
- customer_acquisition：customerGroups/customerAges 只表示希望服务的客户人群与年龄；
- recruitment：recruitmentGroups/recruitmentAges 只表示希望吸引的准增员对象与年龄；
不得把“我现在主要服务企业主”之类客户信息写成准增员对象，也不得反过来。

其他字段含义：city=明确服务/所在城市；insuranceYears=明确保险从业年数；strengths=明确自述优势/性格；honors=明确荣誉；education=明确最高学历；schoolTier=明确985/211/QS等学校背景；overseas=明确留学经历；contentTone=明确希望账号呈现的表达气质；department=明确营销服务部；previousCareer=原文明说“曾任/做过/从事/工作/职业/XX年经验”等职业经历，单独出现“财务/法律/教育/医疗”等领域关键词不得写入；lifeRoles=家庭或生活身份；hobbies=明确兴趣爱好；services=明确可以提供或擅长的服务。

多项内容用“｜”连接。不要把营销话术改写成新事实。
只输出合法 JSON：{"updates":{"字段":"值"},"evidence":{"字段":"对应的原文短语"}}。"""
    payload = {
        "model": os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash"),
        "thinking": {"type": "disabled"},
        "max_tokens": 900,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps({"primaryGoal": goal, "missingFields": missing, "selfIntro": intro}, ensure_ascii=False)},
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
        if key not in allowed or key not in missing or not value:
            continue
        proof = _clean(evidence.get(key))
        if not proof or proof not in intro:
            continue
        if key == "previousCareer" and not _explicit_career_context(proof):
            continue
        updates[key] = value
        safe_evidence[key] = proof
    return {"updates": updates, "evidence": safe_evidence, "source": "semantic"}
