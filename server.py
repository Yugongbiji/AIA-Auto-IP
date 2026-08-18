"""AIA Auto IP internal MVP server.

Run:
    python server.py --import-xlsx data/何不团队报名表20260807.xlsx

The browser only receives the profile returned by an exact name + agent ID match.
Guest profiles stay in the browser session and are never written to the database.
"""

from __future__ import annotations

import argparse
import json
import os
import mimetypes
import re
import sqlite3
import sys
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import openpyxl


ROOT = Path(__file__).parent
DATA_DIR = ROOT / "data"
WEB_DIR = ROOT / "web"
DB_PATH = DATA_DIR / "persona.sqlite3"
DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"
LOCAL_PACKAGES = ROOT / ".python-packages"

if LOCAL_PACKAGES.exists():
    sys.path.insert(0, str(LOCAL_PACKAGES))


def load_local_env():
    """Load local development secrets without a third-party dependency."""
    for env_file in (ROOT / ".env", ROOT / ".env.rds"):
        if not env_file.exists():
            continue
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and value:
                os.environ[key] = value


def deepseek_generate(profile: dict):
    api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("未配置 DEEPSEEK_API_KEY。请在项目根目录的 .env 文件中填写密钥后重试。")

    system_prompt = """你是友邦人寿营销员的社交媒体 IP 定位顾问。
基于给定的单个营销员资料，生成可直接使用、适合手机阅读的中文 IP 方案。客户画像必须根据 customerGroups（服务人群）和 customerAges（客户年龄段）综合表达，绝不凭空补充客户人群。
必须先做六维优势判断（身份/性格/地域/专业/学历/成就）；资料缺失时只弱化表达，绝不臆造。不要向营销员追问资料，也不要输出待补充字段或任何 Markdown。

请只输出一个合法 JSON 对象，必须包含以下结构：
{
  "headline":"一句话定位，不超过26字",
  "subheadline":"自然的补充说明，不超过42字",
  "tags":["3个短标签"],
  "clientPortrait":{"title":"目标客户画像","text":"一段不超过48字的描述"},
  "advantages":[{"emoji":"🎓","title":"短标题","text":"不超过34字"}],
  "nicknameOptions":[{"name":"中文昵称","angle":"突出专业/突出温暖/突出地域等直接表达","reason":"不超过30字"}],
  "bios":{
    "xiaohongshu":[{"label":"方案 A · 专业背书","focus":"不超过18字","lines":["每行是一条可复制文案"]},{"label":"方案 B · 温暖陪伴","focus":"不超过18字","lines":["每行是一条可复制文案"]}],
    "videoDouyin":[{"label":"方案 A · 专业背书","focus":"不超过18字","lines":["每行是一条可复制文案"]},{"label":"方案 B · 温暖陪伴","focus":"不超过18字","lines":["每行是一条可复制文案"]}]
  },
  "platformReminders":["小红书个人简介：7 天限修改 3 次（频繁修改影响账号权重）","视频号昵称：每年最多可修改 5 次","微信视频号简介：暂无明确修改次数限制"]
}

具体要求：
1. tags 必须正好 3 个；advantages 输出 3 到 4 条；nicknameOptions 输出 3 到 5 个。
2. 昵称以中文为主，避免英文和拼音。学历只在名校、硕士及以上、博士或留学背景时突出。nicknameOptions 的 angle 必须用“突出专业”“突出地域”“突出温暖”“突出学历/荣誉”等直接动作表达，不使用“专业感”“地域感”“温暖感”等抽象词。
3. 每个平台必须正好两套简介，体现不同侧重点；每套 4 到 6 行，无空行。每条信息行以匹配含义的单个表情开头，例如学历用 🎓、荣誉用 🏆、城市用 📍、沟通用 💬、声明用 📌。非声明行尽量控制在 16 个汉字左右。
4. 小红书简介不得出现保险、金融、理财、联系方式、引流或友邦/AIA；末行必须为“📌 本账号所述内容为个人意见，不代表任何官方意见。”。
5. 视频号和抖音简介必须包含营销服务部；必须使用“📌 执业编号：000”，不得使用营销员编号；末行必须为“📌 本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见。”。
6. platformReminders 必须逐字使用上面的三条固定提醒。不要提及本工具、对话次数或 AI。"""
    profile_json = json.dumps(profile, ensure_ascii=False, indent=2)
    payload = {
        "model": os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash"),
        "thinking": {"type": "disabled"},
        "max_tokens": 2600,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"营销员资料如下：\n{profile_json}"},
        ],
    }
    request = Request(
        DEEPSEEK_API_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=90) as response:
            body = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"DeepSeek 请求失败（HTTP {error.code}）：{detail}") from error
    except URLError as error:
        raise RuntimeError("无法连接 DeepSeek API，请检查网络或代理设置。") from error
    content = body.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    if not content:
        raise RuntimeError("DeepSeek 没有返回可用内容，请稍后重试。")
    try:
        proposal = json.loads(content)
    except json.JSONDecodeError as error:
        raise RuntimeError("DeepSeek 返回的方案格式不完整，请重新生成。") from error
    if not isinstance(proposal, dict):
        raise RuntimeError("DeepSeek 返回的方案格式不正确，请重新生成。")
    return {"proposal": proposal, "model": body.get("model", payload["model"]), "usage": body.get("usage", {})}


def deepseek_understand(profile: dict, message: str):
    """Turn a natural-language follow-up into safe, reviewable profile updates."""
    api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("未配置 DEEPSEEK_API_KEY。请在项目根目录的 .env 文件中填写密钥后重试。")

    system_prompt = """你是“红人计划”的对话式 IP 助手。营销员已经完成基础资料采集，正在用自然语言补充或修改档案。
你的工作是理解口语化表达，找出其中明确要求更新的资料；不要猜测、不要擅自改资料。称呼必须自然，不要把“亲”当作固定口头禅，更不要每句话开头都加称呼；大多数情况下可省略称呼，偶尔可自然使用姓名或“亲”。不称个人为“红人”；“友邦红人”仅用于描述这个群体或项目，例如“友邦红人计划”。不要使用“用户”“客户”等泛化称呼。语气自然、亲切、轻松，可以有一点恰到好处的小幽默，但不要油腻、不要夸张、不要编造经历。

请只输出一个合法 JSON 对象：
{
  "reply":"给营销员看的简短中文回复，20 到 70 字",
  "updates":{"只放明确提到且需要更新的字段":"新值"}
}

允许更新的字段只有：city、customerGroups、customerAges、insuranceYears、strengths、honors、education、schoolTier、overseas、contentTone、department、generationNotes。
规则：
1. “昵称别太严肃、想有网感”“简介更温暖”等方案风格要求，写入 generationNotes，保留原意。
2. 用户只是打招呼、询问功能、说“我还有补充”或表达不清时，updates 必须为空；reply 要像真实助手一样自然地回应，不要机械地要求“城市改为上海”。
3. 有明确更新时，reply 先简短复述已理解的意图，并说明将请对方确认；不要说已经保存。
4. 不得输出 Markdown、列表符号、字段名、技术术语或任何方案正文。
5. 资料中的内容仅供理解，不得在 reply 中泄露无关个人信息。"""
    payload = {
        "model": os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash"),
        "thinking": {"type": "disabled"},
        "max_tokens": 700,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "当前档案：\n" + json.dumps(profile, ensure_ascii=False) + "\n\n营销员刚刚说：\n" + message},
        ],
    }
    request = Request(
        DEEPSEEK_API_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=45) as response:
            body = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"DeepSeek 请求失败（HTTP {error.code}）：{detail}") from error
    except URLError as error:
        raise RuntimeError("无法连接 DeepSeek API，请检查网络或代理设置。") from error
    content = body.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    try:
        understood = json.loads(content)
    except json.JSONDecodeError as error:
        raise RuntimeError("DeepSeek 没有返回可识别的对话结果，请稍后重试。") from error
    if not isinstance(understood, dict):
        raise RuntimeError("DeepSeek 返回的对话结果格式不正确，请稍后重试。")
    allowed_keys = {"city", "customerGroups", "customerAges", "insuranceYears", "strengths", "honors", "education", "schoolTier", "overseas", "contentTone", "department", "generationNotes"}
    raw_updates = understood.get("updates") if isinstance(understood.get("updates"), dict) else {}
    updates = {key: clean(value) for key, value in raw_updates.items() if key in allowed_keys and clean(value)}
    reply = clean(understood.get("reply"))[:160] or "我在认真听，继续补充就好；有需要写进档案的内容，我会先请你确认。"
    return {"reply": reply, "updates": updates, "model": body.get("model", payload["model"])}


def deepseek_content_plan(profile: dict, planning: dict, current_plan: dict | None = None, revision: str = ""):
    """Create or revise an account content plan from the confirmed 1 + N → 1 + 1 methodology."""
    api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("未配置 DEEPSEEK_API_KEY。请在项目根目录的 .env 文件中填写密钥后重试。")

    system_prompt = """你是友邦红人计划的账号内容规划顾问。你必须严格遵循以下方法：
1. 方法阶段可以提出“保险 + N”候选；第一个 1 永远是保险，N 是根据个人 IP、目标人群、真实经历筛选出的第二内容方向候选。
2. 账号落地只能是“保险 + 1”，只能确定一个最终泛内容主线，绝不能混成保险 + 育儿 + 运动 + 旅行等朋友圈式内容。
3. 每个 N 候选都必须评估：人群是否与准保险客户或准增员对象一致、本人能否持续输出、是否能利他解决问题。
4. 拓客内容按“为什么看你 → 为什么需要保险 → 该了解什么保险 → 为什么找你”的信任路径；增员内容按“为什么看你 → 为什么做保险 → 我能不能做 → 为什么加入团队”的路径。
5. 不臆造个人经历、成绩、客户案例或资质；资料不足时写成“可补充验证”的方向，不把猜测写成事实。不得给出保险收益承诺、夸大或不合规表达。
6. 语气专业、清晰、适合手机阅读；不要 Markdown，不要 #、*。

只输出一个合法 JSON 对象，结构必须是：
{
  "summary":"不超过70字的整体判断",
  "primaryGoal":"拓客为主/增员为主/两者兼顾之一",
  "insuranceLine":{"title":"保险主线名称","reason":"不超过60字"},
  "candidateDirections":[{"direction":"保险 + 某方向","audienceFit":"人群一致判断","sustainable":"持续输出判断","benefit":"利他价值","recommend":true}],
  "finalPositioning":{"label":"保险 + 某一方向","explanation":"不超过80字，说明为何只选这一条"},
  "contentDirections":[{"direction":"内容方向名称","contentBoundary":"内容边界","collectionReferences":["不超过5个汉字的合集名称参考"],"roles":["该方向对吸粉、教育、信任或转化的具体作用"],"topics":["4个首批选题"]}],
  "avoidDirections":[{"direction":"不建议混入的方向","reason":"不超过55字"}],
  "focusReminder":"提醒内容不宜太杂、太随意混发，避免账号像朋友圈，导致平台难判断流量画像。"
}

candidateDirections 输出 2 到 3 项；contentDirections 输出 3 到 5 项；每个内容方向 topics 正好 4 项。每个方向必须输出 1 到 2 个 collectionReferences，且每个合集名称严格不超过 5 个汉字，并用作参考而非方向名称。每个方向必须输出 1 到 3 个 roles，从内容对账号吸粉、教育、建立信任、咨询转化或增员转化的作用出发，必须结合该方向与主目标判断：拓客可使用“让粉丝理解保障需求”“帮助粉丝看懂保障方案”“建立专业与服务信任”等；增员可使用“让准增员理解行业与转型”“展示团队支持与价值观”“建立个人职业可信度”等。内容方向是账号的长期创作主题，不等同于小红书合集。finalPositioning 必须只选择一个保险以外的方向。"""
    request_payload = {
        "profile": profile,
        "planningAnswers": planning,
        "currentPlan": current_plan or None,
        "revisionRequest": revision or None,
    }
    payload = {
        "model": os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash"),
        "thinking": {"type": "disabled"},
        "max_tokens": 3200,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "请根据以下资料生成内容规划；如果带有 revisionRequest，请在保留合理部分的基础上按这条要求改出新版本：\n" + json.dumps(request_payload, ensure_ascii=False)},
        ],
    }
    request = Request(
        DEEPSEEK_API_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=90) as response:
            body = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"DeepSeek 请求失败（HTTP {error.code}）：{detail}") from error
    except URLError as error:
        raise RuntimeError("无法连接 DeepSeek API，请检查网络或代理设置。") from error
    content = body.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    try:
        plan = json.loads(content)
    except json.JSONDecodeError as error:
        raise RuntimeError("DeepSeek 返回的内容规划格式不完整，请重新生成。") from error
    if not isinstance(plan, dict):
        raise RuntimeError("DeepSeek 返回的内容规划格式不正确，请重新生成。")
    return {"plan": plan, "model": body.get("model", payload["model"]), "usage": body.get("usage", {})}


STRUCTURE_MARKER_PATTERN = re.compile(r"^\s*(?:正文|结尾|开头|脚本正文|文案正文|结束语|结语)\s*\d{0,2}\s*[：:]?\s*", re.IGNORECASE)
NUMBERED_TITLE_PATTERN = re.compile(r"^\s*(?:第\s*)?(\d{1,2})\s*[、.．:：)）]\s*(.+?)\s*$")
INLINE_LIBRARY_TITLE_PATTERN = re.compile(r"^\s*(?:第\s*)?(\d{1,2})\s*[、.．:：)）]\s*(.*?)\s*(?:正文|文案正文|脚本正文)\s*\d{0,2}\s*[：:]?\s*(.*)$", re.IGNORECASE)


def strip_structure_markers(text: str) -> str:
    """Remove library-only labels such as '正文' and '结尾', while keeping any following wording."""
    lines = []
    for line in str(text or "").splitlines():
        cleaned_line = STRUCTURE_MARKER_PATTERN.sub("", line).strip()
        if cleaned_line:
            lines.append(cleaned_line)
    return "\n".join(lines).strip()


def extract_numbered_title_sections(source: str) -> list[dict]:
    """Recognise a script-library list such as 1. title / body, 2. title / body."""
    sections = []
    current = None
    for raw_line in str(source or "").splitlines():
        line = raw_line.strip()
        inline_match = INLINE_LIBRARY_TITLE_PATTERN.match(line)
        if inline_match:
            if current and current["body"]:
                sections.append(current)
            current = {"number": inline_match.group(1), "title": inline_match.group(2).strip(), "body": []}
            if inline_match.group(3).strip():
                current["body"].append(inline_match.group(3).strip())
            continue
        title_match = NUMBERED_TITLE_PATTERN.match(line)
        if title_match:
            if current and current["body"]:
                sections.append(current)
            current = {"number": title_match.group(1), "title": title_match.group(2).strip(), "body": []}
            continue
        cleaned_line = STRUCTURE_MARKER_PATTERN.sub("", line).strip()
        if current is not None and cleaned_line:
            current["body"].append(cleaned_line)
    if current and current["body"]:
        sections.append(current)
    # A single numbered item is usually an ordinary list item, not a multi-title script.
    if len(sections) < 2:
        return []
    return [{"number": item["number"], "title": item["title"], "text": "\n".join(item["body"]).strip()} for item in sections]


EMOJI_KEYWORDS = [
    ("理赔", "✅"), ("赔付", "✅"), ("合同", "📄"), ("条款", "📄"), ("责任", "📄"), ("免赔", "📄"),
    ("风险", "⚠️"), ("提醒", "⚠️"), ("注意", "⚠️"), ("警惕", "⚠️"), ("避免", "⚠️"), ("误区", "⚠️"),
    ("健康", "❤️"), ("体检", "🩺"), ("疾病", "🩺"), ("医疗", "🏥"), ("医院", "🏥"),
    ("养老", "🌿"), ("银发", "🌿"), ("长辈", "🌿"), ("教育", "🎓"), ("升学", "🎓"), ("育儿", "🧸"), ("孩子", "🧸"),
    ("家庭", "👪"), ("父母", "👪"), ("夫妻", "💞"), ("保障", "🛡️"), ("保单", "🛡️"), ("保险", "🛡️"),
    ("投保", "📝"), ("保费", "🧾"), ("预算", "🧾"), ("资产", "💰"), ("财富", "💰"), ("理财", "💰"), ("储蓄", "🏦"),
    ("社保", "🏛️"), ("医保", "🏛️"), ("政策", "🏛️"), ("法律", "⚖️"), ("税务", "🧾"),
    ("骑行", "🚴"), ("跑步", "🏃"), ("游泳", "🏊"), ("运动", "🏅"), ("旅行", "✈️"), ("户外", "🏕️"),
    ("企业主", "🏢"), ("创业", "🚀"), ("职场", "💼"), ("工作", "💼"), ("团队", "🤝"), ("客户", "🤝"), ("服务", "🤝"),
    ("时间", "⏰"), ("期限", "⏰"), ("数据", "📊"), ("比例", "📊"), ("金额", "📊"), ("比较", "⚖️"), ("选择", "🔎"),
    ("案例", "🔎"), ("故事", "📖"), ("沟通", "💬"), ("对话", "💬"), ("重点", "📌"), ("总结", "📌"), ("核心", "📌"),
    ("步骤", "🧭"), ("方法", "💡"), ("建议", "💡"), ("清单", "📋"), ("计划", "🧭"),
]


def add_scan_emojis(formatted: str) -> str:
    """Keep emoji cues distributed: every three sentences get at least one cue."""
    parts = re.split(r"(?<=[。！？!?])", formatted)
    sentence_indexes = [index for index, part in enumerate(parts) if part.strip()]
    if not sentence_indexes:
        return formatted
    neutral_emojis = ("📌", "💡", "✨", "✅")
    neutral_index = 0
    for group_start in range(0, len(sentence_indexes), 3):
        group = sentence_indexes[group_start:group_start + 3]
        if any(any(is_emoji_component(char) for char in parts[index]) for index in group):
            continue
        index = group[0]
        part = parts[index]
        inserted = False
        for keyword, emoji in EMOJI_KEYWORDS:
            position = part.find(keyword)
            if position >= 0:
                parts[index] = f"{part[:position + len(keyword)]}{emoji}{part[position + len(keyword):]}"
                inserted = True
                break
        if not inserted:
            parts[index] = f"{neutral_emojis[neutral_index % len(neutral_emojis)]} {part.lstrip()}"
            neutral_index += 1
    return "".join(parts)


def clean_suggested_tags(raw_tags, source: str) -> list[str]:
    """Keep 10–15 short, de-duplicated publishing suggestions outside the copied text."""
    tags = []
    for item in raw_tags if isinstance(raw_tags, list) else []:
        tag = re.sub(r"^[#＃\s]+", "", clean(item)).strip()
        tag = re.sub(r"\s+", "", tag)
        if 2 <= len(tag) <= 12 and tag not in tags:
            tags.append(tag)
        if len(tags) == 15:
            return tags
    fallback = ["保险科普", "保障规划", "风险管理", "家庭保障", "保险知识", "长期规划", "保障意识", "安心生活", "家庭规划", "生活保障", "风险防范", "保险干货", "规划建议", "生活方式", "专业分享"]
    for tag in fallback:
        if tag not in tags:
            tags.append(tag)
        if len(tags) >= 10:
            break
    return tags[:15]


def deepseek_script_rewrite(profile: dict, ip_plan: dict | None, source: str, revision: str = ""):
    """Rewrite a supplied script without inventing facts and with the confirmed IP used only when relevant."""
    api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("未配置 DEEPSEEK_API_KEY。请在项目根目录的 .env 文件中填写密钥后重试。")
    system_prompt = """你是友邦红人计划的脚本改写助手。任务是改写营销员粘贴的原文，不是重新创作相反观点。
必须保留原文的知识点、事实、数字、产品名称、产品责任、适用范围、限制条件和核心结论。不能用外部知识擅自纠正、增加、删除或改写专业信息。无法确认的产品、理赔、医学、法律、政策、税务信息保留原意，并以“需核对”“以官方材料为准”或“建议咨询相应专业人士”处理。
合规诊断与改写只能依据用户提供的《爆款文案合规改写指令 V5.0》；不得使用模型自行扩展的敏感词库、未提供的平台规则或主观判断。仅处理该文件明确列出的风险：绝对化或极限表达、保险责任与赔付承诺、收益暗示、贬低同业/社保/医保/惠民保、促销限时、返佣返现或赠礼诱导、站外引流与直接销售引导、悲情恐慌营销、隐私泄露、未经核对的产品/理赔/医学/法律/政策/税务表述，以及未经审核的增员承诺。普通正向形容词本身不构成风险；“非常实用”“很实用”“有帮助”“值得看”等单独出现时必须保留，不得标为夸大或强制改写，除非同时形成文件中明确禁止的承诺、极限表达或误导。
可参考已确认的 IP 资料，但仅当原文确实需要个人表达、服务对象、信任建立或个人风格时自然带入；只能使用资料中真实明确的信息，不能强行写成“我的客户”“我从业多年”等。纯知识科普和产品责任说明不强行加入人设。
脚本库的“正文”“正文1”“正文2”“结尾”“开头”“脚本正文”“结语”等只是内部结构标记，绝对不要写进改写稿。若输入中有连续的编号标题（例如“1. 标题甲”“2. 标题乙”“3. 标题丙”），必须识别为多个独立选题：每个选题单独改写，不能合并在一篇产出中。输出卡片标签只展示干净的标题名称，text 内不要重复编号标题、正文、结尾或其序号。
没有多个编号标题时，默认生成 3 篇完整改写稿：开头、切入角度、结构和结尾行动要明显不同，三篇不得只是替换词语；保持自然口语、短句、手机阅读节奏。每篇正文只包含可直接发布的标题、正文及必要合规提示，不要 Markdown、分析说明或版本编号。
在改写稿前，必须输出一份面向营销员的简明“稿件处理说明”。它只陈述基于原稿可核对的编辑结论，不展示冗长推理，不虚构原文没有的知识点或风险。说明需写清：锁定的知识点（2 至 5 条）、推荐的开头方式、正文结构、结尾方式、人设带入情况，以及合规调整。合规调整只记录命中文件明列类别的内容；若未发现需要调整的合规表达，要明确写“未发现 V5.0 文件中需改动的明显风险表达，仍请以最新公司规则核对”。

只输出合法 JSON：
{
  "summary":"不超过60字的改写说明",
  "breakdown":{
    "knowledgePoints":["从原稿锁定的知识点，2至5条"],
    "opening":"不超过70字，说明推荐使用的开头方式及原因",
    "structure":"不超过90字，说明正文的内容结构",
    "closing":"不超过70字，说明结尾采用的方式",
    "ipUse":"不超过70字，说明是否带入已确认 IP；未带入也要说明原因",
    "complianceAdjustments":["具体合规调整；没有则写未发现需改动的明显风险表达，仍请以最新公司规则核对"]
  },
  "versions":[
    {"label":"改写稿 1","focus":"不超过20字","text":"完整可发布文案"},
    {"label":"改写稿 2","focus":"不超过20字","text":"完整可发布文案"},
    {"label":"改写稿 3","focus":"不超过20字","text":"完整可发布文案"}
  ],
  "suggestedTags":["根据本次脚本主题提炼的标签，不含#，给出12个并按优先级排序，前5个必须是最应优先尝试的核心标签"]
}"""
    payload = {
        "model": os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash"),
        "thinking": {"type": "disabled"},
        "max_tokens": 4200,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps({"profile": profile, "ipPlan": ip_plan or {}, "original": strip_structure_markers(source), "numberedTitleSections": extract_numbered_title_sections(source), "revisionRequest": revision or None}, ensure_ascii=False)},
        ],
    }
    request = Request(DEEPSEEK_API_URL, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"), headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(request, timeout=120) as response:
            body = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"DeepSeek 请求失败（HTTP {error.code}）：{detail}") from error
    except URLError as error:
        raise RuntimeError("无法连接 DeepSeek API，请检查网络或代理设置。") from error
    try:
        result = json.loads(body.get("choices", [{}])[0].get("message", {}).get("content", "").strip())
    except json.JSONDecodeError as error:
        raise RuntimeError("DeepSeek 返回的改写格式不完整，请重新提交原文。") from error
    versions = result.get("versions") if isinstance(result, dict) else None
    title_sections = extract_numbered_title_sections(source)
    expected_count = len(title_sections) if title_sections else 3
    if not isinstance(versions, list) or len(versions) < expected_count:
        raise RuntimeError(f"DeepSeek 没有返回 {expected_count} 篇完整改写稿，请重新生成。")
    cleaned = []
    for index, item in enumerate(versions[:expected_count], 1):
        if not isinstance(item, dict) or not clean(item.get("text")):
            raise RuntimeError("DeepSeek 返回的改写稿不完整，请重新生成。")
        title = title_sections[index - 1]["title"] if title_sections else ""
        label = f"标题 · {title}" if title else (clean(item.get("label")) or f"改写稿 {index}")
        cleaned.append({"label": label[:80], "focus": clean(item.get("focus"))[:40], "text": strip_structure_markers(clean(item.get("text")))[:20000]})
    breakdown = result.get("breakdown") if isinstance(result, dict) else {}
    breakdown = breakdown if isinstance(breakdown, dict) else {}
    knowledge_points = [clean(item)[:120] for item in breakdown.get("knowledgePoints", []) if clean(item)][:5] if isinstance(breakdown.get("knowledgePoints"), list) else []
    compliance_adjustments = [clean(item)[:160] for item in breakdown.get("complianceAdjustments", []) if clean(item)][:6] if isinstance(breakdown.get("complianceAdjustments"), list) else []
    safe_breakdown = {
        "knowledgePoints": knowledge_points,
        "opening": clean(breakdown.get("opening"))[:160],
        "structure": clean(breakdown.get("structure"))[:180],
        "closing": clean(breakdown.get("closing"))[:160],
        "ipUse": clean(breakdown.get("ipUse"))[:160],
        "complianceAdjustments": compliance_adjustments,
    }
    suggested_tags = clean_suggested_tags(result.get("suggestedTags") if isinstance(result, dict) else [], strip_structure_markers(source))
    return {"summary": clean(result.get("summary"))[:160], "breakdown": safe_breakdown, "versions": cleaned, "suggestedTags": suggested_tags, "model": body.get("model", payload["model"])}


def deepseek_script_intent(profile: dict, ip_plan: dict | None, current_source: str, message: str):
    """Classify a follow-up in the script workspace before deciding whether to rewrite."""
    api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("未配置 DEEPSEEK_API_KEY。请在项目根目录的 .env 文件中填写密钥后重试。")
    system_prompt = """你是友邦红人计划的脚本改写对话助手。营销员已经有一篇当前脚本，现在发送了一条新消息。
请判断该消息属于且只属于以下一种 intent：
1. new_script：消息本身是一篇新的、可直接改写的完整脚本，和当前脚本不是同一篇。
2. rewrite_request：营销员明确要求按照某些意见重新改写当前脚本，例如“按这个重写”“改成更口语后重新出稿”。
3. feedback：只是给出一两条修改建议或偏好，但没有明确要求立刻重新改写。
4. question：提问、质疑、澄清或其他聊天内容。

只有 new_script 或 rewrite_request 才会触发改写。feedback 必须自然确认已收到的要点，并邀请营销员继续补充，或明确说“按这些重新改写”后再出稿；question 要直接、友好地回答，特别是营销员说“我发的是新的脚本”时，先承认并说明会将其按新稿处理。不要机械地重复固定句式，不要使用 Markdown、列表符号、字段名或技术术语。不得编造任何原文事实。

只输出合法 JSON：
{"intent":"new_script/rewrite_request/feedback/question","reply":"不超过110字的自然回复","revisionInstruction":"仅 rewrite_request 时，提炼不超过160字的改写要求；其他情况为空"}"""
    payload = {
        "model": os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash"),
        "thinking": {"type": "disabled"},
        "max_tokens": 500,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": json.dumps({"profile": profile, "ipPlan": ip_plan or {}, "currentScript": current_source[-8000:], "message": message}, ensure_ascii=False)}],
    }
    request = Request(DEEPSEEK_API_URL, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"), headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(request, timeout=60) as response:
            body = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"DeepSeek 请求失败（HTTP {error.code}）：{detail}") from error
    except URLError as error:
        raise RuntimeError("无法连接 DeepSeek API，请检查网络或代理设置。") from error
    try:
        result = json.loads(body.get("choices", [{}])[0].get("message", {}).get("content", "").strip())
    except json.JSONDecodeError as error:
        raise RuntimeError("DeepSeek 没有理解这条消息，请换一种说法。") from error
    intent = clean(result.get("intent")) if isinstance(result, dict) else ""
    if intent not in {"new_script", "rewrite_request", "feedback", "question"}:
        intent = "question"
    reply = clean(result.get("reply"))[:220] or "我已经理解你的意思了。"
    revision_instruction = clean(result.get("revisionInstruction"))[:300]
    return {"intent": intent, "reply": reply, "revisionInstruction": revision_instruction, "model": body.get("model", payload["model"])}


def deepseek_xhs_intent(profile: dict, current_source: str, message: str):
    """Classify a follow-up in the Xiaohongshu workspace before formatting."""
    api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("未配置 DEEPSEEK_API_KEY。请在项目根目录的 .env 文件中填写密钥后重试。")
    system_prompt = """你是友邦红人计划的小红书排版对话助手。营销员已经有一篇当前文章，现在发送了一条新消息。
请判断该消息属于且只属于以下一种 intent：
1. new_content：消息本身是一篇新的、可直接排版的完整文章，和当前文章不是同一篇。
2. format_request：营销员明确要求按照某些意见重新排版当前文章，例如“按这个重排”“再排一版”“把表情多加一点后重新排版”。
3. feedback：只是给出一两条排版建议或偏好，但没有明确要求立刻重新排版。
4. question：提问、质疑、澄清或其他聊天内容。

只有 new_content 或 format_request 才会触发排版。feedback 必须自然确认已收到的要点，并邀请营销员继续补充，或明确说“按这些重新排版”后再输出；question 要直接、友好地回答，特别是营销员说“我发的是新的文章”时，先承认并说明会将其按新文章处理。不要机械地重复固定句式，不要使用 Markdown、列表符号、字段名或技术术语。小红书排版只调整换行、段落与 emoji，不改动原文表达。

只输出合法 JSON：
{"intent":"new_content/format_request/feedback/question","reply":"不超过110字的自然回复","formatInstruction":"仅 format_request 时，提炼不超过160字的排版要求；其他情况为空"}"""
    payload = {
        "model": os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash"),
        "thinking": {"type": "disabled"},
        "max_tokens": 500,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": json.dumps({"profile": profile, "currentArticle": current_source[-8000:], "message": message}, ensure_ascii=False)}],
    }
    request = Request(DEEPSEEK_API_URL, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"), headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(request, timeout=60) as response:
            body = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"DeepSeek 请求失败（HTTP {error.code}）：{detail}") from error
    except URLError as error:
        raise RuntimeError("无法连接 DeepSeek API，请检查网络或代理设置。") from error
    try:
        result = json.loads(body.get("choices", [{}])[0].get("message", {}).get("content", "").strip())
    except json.JSONDecodeError as error:
        raise RuntimeError("DeepSeek 没有理解这条消息，请换一种说法。") from error
    intent = clean(result.get("intent")) if isinstance(result, dict) else ""
    if intent not in {"new_content", "format_request", "feedback", "question"}:
        intent = "question"
    reply = clean(result.get("reply"))[:220] or "我已经理解你的意思了。"
    format_instruction = clean(result.get("formatInstruction"))[:300]
    return {"intent": intent, "reply": reply, "formatInstruction": format_instruction, "model": body.get("model", payload["model"])}


def is_emoji_component(char: str) -> bool:
    point = ord(char)
    return point in {0x200D, 0xFE0F, 0x20E3} or 0x1F000 <= point <= 0x1FAFF or 0x2600 <= point <= 0x27BF


def preserves_source_text(source: str, formatted: str) -> bool:
    """Allow whitespace and emoji insertions only; all original characters must remain in order."""
    original = [char for char in source if not char.isspace()]
    cursor = 0
    for char in formatted:
        if char.isspace():
            continue
        if cursor < len(original) and char == original[cursor]:
            cursor += 1
        elif not is_emoji_component(char):
            return False
    return cursor == len(original)


def deepseek_xhs_format(source: str, instruction: str = ""):
    """Format text for Xiaohongshu while enforcing that no source wording changes."""
    api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("未配置 DEEPSEEK_API_KEY。请在项目根目录的 .env 文件中填写密钥后重试。")
    title_sections = extract_numbered_title_sections(source)
    display_source = strip_structure_markers(source)
    system_prompt = """你是小红书排版助手，不是改写助手。绝对不能修改、删除、替换、调换待排版原文的任何文字和标点，也不能增加观点、事实、承诺或营销引导。
脚本库的“正文”“正文1”“正文2”“结尾”“开头”“脚本正文”“结语”等是内部结构标记，绝对不要写进排版结果。若输入给出多个编号标题，必须拆成独立内容：每段对应一个标题，不能把三个标题及正文挤在同一段。系统会在文本框外展示干净标题，formattedSections 的 text 内不要重复编号标题、结构标记或其序号。
你只能在原文中加入换行、段落空行，以及与段落含义匹配的 emoji。建议每句不超过20个汉字、每段不超过5行；按语义断句，不拆产品名、数字和专有名词。标题独立成行；不要 Markdown、井号或星号。emoji 用于快速扫读，原则上每 2 至 3 句话配置 1 个；必须根据标题或句中核心词、场景和语义自动匹配，不局限于固定几个表情。例如理赔✅、合同📄、健康❤️、医疗🏥、教育🎓、育儿🧸、养老🌿、财富💰、职场💼、运动🏅、旅行✈️、政策🏛️、法律⚖️、数据📊、案例🔎、沟通💬、清单📋等；可根据实际语义选用其他同样恰当的 emoji，避免全文反复使用同一种。表情可放在段首，也可紧跟关键词。若连续三句话都没有适合匹配的关键词，也必须选择其中一句在句首加入一个中性 emoji（如📌、💡、✨、✅），保证最多连续三句话没有表情。不得修改或拆开任何原文字词，避免连续堆叠或每句都加。
同时只做初步表达风险检测，不判断专业事实真假。风险判断只能依据用户提供的《爆款文案合规改写指令 V5.0》，不得自行扩展为泛化敏感词检测。仅识别文件明列的绝对化或极限表达、收益或赔付承诺、恐慌营销、贬低同业/社保/医保/惠民保、促销限时、返佣返现或赠礼诱导、站外导流与直接销售引导、隐私泄露、违规增员承诺，以及需要核对的产品、理赔、医学、法律、政策或税务表述。“非常实用”“很实用”“有帮助”“值得看”等普通正向形容词单独出现时不是风险，不得提示。风险片段必须逐字来自原文。
只输出合法 JSON：
{"formattedText":"无多标题时，只加入换行或 emoji 的完整原文","formattedSections":[{"text":"有多个编号标题时，每个标题对应的排版原文"}],"suggestedTags":["根据全文提炼的标签，不含#，必须给出12个并按优先级排序，前5个必须是最应优先尝试的核心标签"],"risks":[{"snippet":"原文片段","type":"风险类型","reason":"不超过55字","suggestion":"不超过55字"}]}
risks 最多 8 条；没有明显风险时返回空数组。"""
    payload = {
        "model": os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash"),
        "thinking": {"type": "disabled"},
        "max_tokens": 2600,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": json.dumps({"original": display_source, "numberedTitleSections": title_sections, "formatInstruction": instruction or None}, ensure_ascii=False)}],
    }
    request = Request(DEEPSEEK_API_URL, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"), headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(request, timeout=90) as response:
            body = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"DeepSeek 请求失败（HTTP {error.code}）：{detail}") from error
    except URLError as error:
        raise RuntimeError("无法连接 DeepSeek API，请检查网络或代理设置。") from error
    try:
        result = json.loads(body.get("choices", [{}])[0].get("message", {}).get("content", "").strip())
    except json.JSONDecodeError as error:
        raise RuntimeError("DeepSeek 返回的排版格式不完整，请重新提交原文。") from error
    formatted = clean(result.get("formattedText")) if isinstance(result, dict) else ""
    formatted_sections = []
    if title_sections:
        candidate_sections = result.get("formattedSections") if isinstance(result, dict) else None
        if isinstance(candidate_sections, list) and len(candidate_sections) >= len(title_sections):
            for index, section in enumerate(title_sections):
                candidate = clean(candidate_sections[index].get("text")) if isinstance(candidate_sections[index], dict) else ""
                if not candidate or not preserves_source_text(section["text"], candidate):
                    formatted_sections = []
                    break
                formatted_sections.append({"label": f"标题 · {section['title']}", "text": add_scan_emojis(candidate)})
        if not formatted_sections:
            formatted_sections = [{"label": f"标题 · {section['title']}", "text": add_scan_emojis(section["text"])} for section in title_sections]
        formatted = "\n\n".join(item["text"] for item in formatted_sections)
    elif not formatted or not preserves_source_text(display_source, formatted):
        formatted = display_source
    if not title_sections:
        formatted = add_scan_emojis(formatted)
    risks = result.get("risks") if isinstance(result, dict) else []
    safe_risks = []
    for item in risks if isinstance(risks, list) else []:
        if not isinstance(item, dict):
            continue
        snippet = clean(item.get("snippet"))
        if not snippet or snippet not in source:
            continue
        safe_risks.append({"snippet": snippet[:180], "type": clean(item.get("type"))[:40], "reason": clean(item.get("reason"))[:120], "suggestion": clean(item.get("suggestion"))[:120]})
        if len(safe_risks) == 8:
            break
    suggested_tags = clean_suggested_tags(result.get("suggestedTags") if isinstance(result, dict) else [], "\n".join(section["text"] for section in title_sections) if title_sections else display_source)
    return {"formattedText": formatted, "formattedSections": formatted_sections, "suggestedTags": suggested_tags, "risks": safe_risks, "model": body.get("model", payload["model"])}


def clean(value):
    if value is None:
        return ""
    return str(value).strip()


def database_engine() -> str:
    return os.getenv("DB_ENGINE", "sqlite").strip().lower() or "sqlite"


class PostgresConnection:
    """Small compatibility wrapper so the app can use SQLite or PostgreSQL."""

    def __init__(self, connection):
        self.connection = connection

    def __enter__(self):
        self.connection.__enter__()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return self.connection.__exit__(exc_type, exc_value, traceback)

    def execute(self, statement: str, params=()):
        # Existing statements use SQLite's ? placeholders. psycopg uses %s.
        return self.connection.execute(statement.replace("?", "%s"), params)

    def executescript(self, script: str):
        for statement in script.split(";"):
            if statement.strip():
                self.connection.execute(statement)


def database():
    engine = database_engine()
    if engine == "sqlite":
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn
    if engine != "postgresql":
        raise RuntimeError("DB_ENGINE 只能设置为 sqlite 或 postgresql。")

    required = ("DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD")
    missing = [key for key in required if not os.getenv(key, "").strip()]
    if missing:
        raise RuntimeError(f"未配置 PostgreSQL：缺少 {', '.join(missing)}。请检查 .env 文件。")
    try:
        import psycopg
        from psycopg.rows import dict_row
    except ImportError as error:
        raise RuntimeError("未安装 PostgreSQL 驱动。请运行：pip install -r requirements.txt") from error

    conn = psycopg.connect(
        host=os.environ["DB_HOST"].strip(),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.environ["DB_NAME"].strip(),
        user=os.environ["DB_USER"].strip(),
        password=os.environ["DB_PASSWORD"],
        sslmode=os.getenv("DB_SSLMODE", "require").strip() or "require",
        connect_timeout=10,
        row_factory=dict_row,
    )
    return PostgresConnection(conn)


def initialize_database():
    DATA_DIR.mkdir(exist_ok=True)
    id_column = "INTEGER PRIMARY KEY AUTOINCREMENT" if database_engine() == "sqlite" else "BIGSERIAL PRIMARY KEY"
    with database() as conn:
        conn.executescript(
            f"""
            CREATE TABLE IF NOT EXISTS agents (
                agent_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                survey_json TEXT NOT NULL,
                imported_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS saved_profiles (
                agent_id TEXT PRIMARY KEY,
                profile_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(agent_id) REFERENCES agents(agent_id)
            );
            CREATE TABLE IF NOT EXISTS conversation_messages (
                id {id_column},
                agent_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(agent_id) REFERENCES agents(agent_id)
            );
            CREATE INDEX IF NOT EXISTS idx_conversation_messages_agent_id
                ON conversation_messages(agent_id, id);
            CREATE TABLE IF NOT EXISTS proposals (
                id {id_column},
                agent_id TEXT NOT NULL,
                version INTEGER NOT NULL,
                proposal_json TEXT NOT NULL,
                model TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(agent_id) REFERENCES agents(agent_id),
                UNIQUE(agent_id, version)
            );
            CREATE TABLE IF NOT EXISTS content_planning_messages (
                id {id_column},
                agent_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(agent_id) REFERENCES agents(agent_id)
            );
            CREATE INDEX IF NOT EXISTS idx_content_planning_messages_agent_id
                ON content_planning_messages(agent_id, id);
            CREATE TABLE IF NOT EXISTS content_plans (
                id {id_column},
                agent_id TEXT NOT NULL,
                version INTEGER NOT NULL,
                plan_json TEXT NOT NULL,
                model TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(agent_id) REFERENCES agents(agent_id),
                UNIQUE(agent_id, version)
            );
            CREATE TABLE IF NOT EXISTS creative_tool_messages (
                id {id_column},
                agent_id TEXT NOT NULL,
                tool TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                result_json TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(agent_id) REFERENCES agents(agent_id)
            );
            CREATE INDEX IF NOT EXISTS idx_creative_tool_messages_agent_id
                ON creative_tool_messages(agent_id, tool, id);
            """
        )


def header_key(header: str) -> str | None:
    if header == "姓名":
        return "name"
    if header == "营销员编号":
        return "agentId"
    if header == "城市":
        return "city"
    if "培训确认" in header:
        return "trainingConfirm"
    if "简单的自我介绍" in header or header == "自我介绍":
        return "selfIntro"
    if header == "微信视频号昵称":
        return "videoNickname"
    if header == "微信视频号ID":
        return "videoId"
    if header == "微信视频号粉丝数":
        return "videoFans"
    if header == "小红书号":
        return "xhsId"
    if header == "小红书号粉丝数":
        return "xhsFans"
    if header == "小红书主页链接":
        return "xhsLink"
    if "缘故" in header and "自媒体" in header:
        return "referralResult"
    if "公域陌生" in header:
        return "publicLeadResult"
    if "业绩转化" in header:
        return "conversionResult"
    if "主要目的" in header:
        return "purpose"
    if "账号运营的状态" in header:
        return "status"
    if "卡点" in header:
        return "painpoints"
    if "付出多少时间" in header:
        return "timeInvest"
    if "暂未达到预期" in header:
        return "planB"
    if header == "入职日期":
        return "joinDate"
    if header == "年龄":
        return "age"
    if header == "最新职级":
        return "jobLevel"
    return None


def import_signup_sheet(source: Path):
    workbook = openpyxl.load_workbook(source, read_only=True, data_only=True)
    sheet = workbook.worksheets[0]
    rows = sheet.iter_rows(values_only=True)
    headers = [clean(value) for value in next(rows)]
    keys = [header_key(header) for header in headers]
    now = datetime.now(timezone.utc).isoformat()
    imported = 0

    with database() as conn:
        for row in rows:
            record = {
                key: clean(value)
                for key, value in zip(keys, row)
                if key and clean(value)
            }
            if not record.get("name") or not record.get("agentId"):
                continue
            existing = conn.execute(
                "SELECT survey_json FROM agents WHERE agent_id = ?", (record["agentId"],)
            ).fetchone()
            merged_record = json.loads(existing["survey_json"]) if existing else {}
            merged_record.update(record)
            conn.execute(
                """
                INSERT INTO agents(agent_id, name, survey_json, imported_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(agent_id) DO UPDATE SET
                  name=excluded.name,
                  survey_json=excluded.survey_json,
                  imported_at=excluded.imported_at
                """,
                (record["agentId"], record["name"], json.dumps(merged_record, ensure_ascii=False), now),
            )
            imported += 1
    return imported


def merged_profile(agent_id: str):
    with database() as conn:
        row = conn.execute(
            """
            SELECT agents.name, agents.survey_json, saved_profiles.profile_json, saved_profiles.updated_at
            FROM agents LEFT JOIN saved_profiles ON agents.agent_id = saved_profiles.agent_id
            WHERE agents.agent_id = ?
            """,
            (agent_id,),
        ).fetchone()
    if not row:
        return None
    profile = json.loads(row["survey_json"])
    if row["profile_json"]:
        profile.update(json.loads(row["profile_json"]))
    return {"profile": profile, "updatedAt": row["updated_at"]}


def save_profile(agent_id: str, profile: dict):
    protected = {"name", "agentId"}
    updates = {key: value for key, value in profile.items() if key not in protected}
    now = datetime.now(timezone.utc).isoformat()
    with database() as conn:
        exists = conn.execute("SELECT 1 FROM agents WHERE agent_id = ?", (agent_id,)).fetchone()
        if not exists:
            return False
        conn.execute(
            """
            INSERT INTO saved_profiles(agent_id, profile_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(agent_id) DO UPDATE SET
              profile_json=excluded.profile_json,
              updated_at=excluded.updated_at
            """,
            (agent_id, json.dumps(updates, ensure_ascii=False), now),
        )
    return True


def conversation_history(agent_id: str):
    with database() as conn:
        rows = conn.execute(
            """
            SELECT role, content, created_at
            FROM conversation_messages
            WHERE agent_id = ?
            ORDER BY id ASC
            """,
            (agent_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def save_conversation_message(agent_id: str, role: str, content: str):
    if role not in {"user", "assistant", "system"} or not content or len(content) > 20000:
        return False
    now = datetime.now(timezone.utc).isoformat()
    with database() as conn:
        exists = conn.execute("SELECT 1 FROM agents WHERE agent_id = ?", (agent_id,)).fetchone()
        if not exists:
            return False
        conn.execute(
            """
            INSERT INTO conversation_messages(agent_id, role, content, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (agent_id, role, content, now),
        )
    return True


def proposal_history(agent_id: str):
    with database() as conn:
        rows = conn.execute(
            """
            SELECT version, proposal_json, model, created_at
            FROM proposals WHERE agent_id = ? ORDER BY version DESC LIMIT 10
            """,
            (agent_id,),
        ).fetchall()
    return [
        {"version": row["version"], "proposal": json.loads(row["proposal_json"]), "model": row["model"], "createdAt": row["created_at"]}
        for row in rows
    ]


def save_proposal(agent_id: str, proposal: dict, model: str):
    now = datetime.now(timezone.utc).isoformat()
    with database() as conn:
        exists = conn.execute("SELECT 1 FROM agents WHERE agent_id = ?", (agent_id,)).fetchone()
        if not exists:
            return None
        version_row = conn.execute(
            "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM proposals WHERE agent_id = ?", (agent_id,)
        ).fetchone()
        version = version_row["next_version"] if isinstance(version_row, dict) else version_row[0]
        conn.execute(
            """
            INSERT INTO proposals(agent_id, version, proposal_json, model, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (agent_id, version, json.dumps(proposal, ensure_ascii=False), model, now),
        )
    return version


def content_planning_history(agent_id: str):
    with database() as conn:
        rows = conn.execute(
            """
            SELECT role, content, created_at FROM content_planning_messages
            WHERE agent_id = ? ORDER BY id ASC
            """,
            (agent_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def save_content_planning_message(agent_id: str, role: str, content: str):
    if role not in {"user", "assistant", "system"} or not content or len(content) > 20000:
        return False
    now = datetime.now(timezone.utc).isoformat()
    with database() as conn:
        exists = conn.execute("SELECT 1 FROM agents WHERE agent_id = ?", (agent_id,)).fetchone()
        if not exists:
            return False
        conn.execute(
            "INSERT INTO content_planning_messages(agent_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (agent_id, role, content, now),
        )
    return True


def save_creative_tool_message(agent_id: str, tool: str, role: str, content: str, result: dict | None = None):
    if tool not in {"script", "xhs"} or role not in {"user", "assistant", "system"} or not content or len(content) > 30000:
        return False
    now = datetime.now(timezone.utc).isoformat()
    with database() as conn:
        exists = conn.execute("SELECT 1 FROM agents WHERE agent_id = ?", (agent_id,)).fetchone()
        if not exists:
            return False
        conn.execute(
            "INSERT INTO creative_tool_messages(agent_id, tool, role, content, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (agent_id, tool, role, content, json.dumps(result, ensure_ascii=False) if isinstance(result, dict) else None, now),
        )
    return True


def creative_tool_history(agent_id: str):
    with database() as conn:
        rows = conn.execute(
            "SELECT tool, role, content, result_json, created_at FROM creative_tool_messages WHERE agent_id = ? ORDER BY id ASC",
            (agent_id,),
        ).fetchall()
    history = []
    for row in rows:
        item = dict(row)
        item["result"] = json.loads(item.pop("result_json")) if item.get("result_json") else None
        history.append(item)
    return history


def content_plan_history(agent_id: str):
    with database() as conn:
        rows = conn.execute(
            "SELECT version, plan_json, model, created_at FROM content_plans WHERE agent_id = ? ORDER BY version DESC LIMIT 10",
            (agent_id,),
        ).fetchall()
    return [{"version": row["version"], "plan": json.loads(row["plan_json"]), "model": row["model"], "createdAt": row["created_at"]} for row in rows]


def save_content_plan(agent_id: str, plan: dict, model: str):
    now = datetime.now(timezone.utc).isoformat()
    with database() as conn:
        exists = conn.execute("SELECT 1 FROM agents WHERE agent_id = ?", (agent_id,)).fetchone()
        if not exists:
            return None
        version_row = conn.execute(
            "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM content_plans WHERE agent_id = ?", (agent_id,)
        ).fetchone()
        version = version_row["next_version"] if isinstance(version_row, dict) else version_row[0]
        conn.execute(
            "INSERT INTO content_plans(agent_id, version, plan_json, model, created_at) VALUES (?, ?, ?, ?, ?)",
            (agent_id, version, json.dumps(plan, ensure_ascii=False), model, now),
        )
    return version


def database_counts():
    """Return a small, non-sensitive health summary for the configured database."""
    with database() as conn:
        return {
            "agents": conn.execute("SELECT COUNT(*) AS count FROM agents").fetchone()["count"],
            "profiles": conn.execute("SELECT COUNT(*) AS count FROM saved_profiles").fetchone()["count"],
            "messages": conn.execute("SELECT COUNT(*) AS count FROM conversation_messages").fetchone()["count"],
            "proposals": conn.execute("SELECT COUNT(*) AS count FROM proposals").fetchone()["count"],
        }


def migrate_sqlite_to_postgres(source: Path = DB_PATH):
    """Copy current local records once; safe to re-run because rows are upserted."""
    if database_engine() != "postgresql":
        raise RuntimeError("迁移前请在 .env 中设置 DB_ENGINE=postgresql。")
    if not source.exists():
        raise RuntimeError(f"未找到本地数据库：{source}")

    local = sqlite3.connect(source)
    local.row_factory = sqlite3.Row
    try:
        tables = ("agents", "saved_profiles", "conversation_messages", "proposals")
        with database() as remote:
            for table in tables:
                exists = local.execute(
                    "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
                ).fetchone()
                if not exists:
                    continue
                rows = local.execute(f"SELECT * FROM {table} ORDER BY id" if table in {"conversation_messages", "proposals"} else f"SELECT * FROM {table}").fetchall()
                for row in rows:
                    if table == "agents":
                        remote.execute(
                            """INSERT INTO agents(agent_id, name, survey_json, imported_at) VALUES (?, ?, ?, ?)
                            ON CONFLICT(agent_id) DO UPDATE SET name=excluded.name, survey_json=excluded.survey_json, imported_at=excluded.imported_at""",
                            (row["agent_id"], row["name"], row["survey_json"], row["imported_at"]),
                        )
                    elif table == "saved_profiles":
                        remote.execute(
                            """INSERT INTO saved_profiles(agent_id, profile_json, updated_at) VALUES (?, ?, ?)
                            ON CONFLICT(agent_id) DO UPDATE SET profile_json=excluded.profile_json, updated_at=excluded.updated_at""",
                            (row["agent_id"], row["profile_json"], row["updated_at"]),
                        )
                    elif table == "conversation_messages":
                        duplicate = remote.execute(
                            "SELECT 1 FROM conversation_messages WHERE agent_id = ? AND role = ? AND content = ? AND created_at = ?",
                            (row["agent_id"], row["role"], row["content"], row["created_at"]),
                        ).fetchone()
                        if not duplicate:
                            remote.execute(
                                "INSERT INTO conversation_messages(agent_id, role, content, created_at) VALUES (?, ?, ?, ?)",
                                (row["agent_id"], row["role"], row["content"], row["created_at"]),
                            )
                    else:
                        remote.execute(
                            """INSERT INTO proposals(agent_id, version, proposal_json, model, created_at) VALUES (?, ?, ?, ?, ?)
                            ON CONFLICT(agent_id, version) DO UPDATE SET proposal_json=excluded.proposal_json, model=excluded.model, created_at=excluded.created_at""",
                            (row["agent_id"], row["version"], row["proposal_json"], row["model"], row["created_at"]),
                        )
    finally:
        local.close()
    return database_counts()


class AppHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def send_json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/lookup":
            query = parse_qs(parsed.query)
            name = clean(query.get("name", [""])[0])
            agent_id = clean(query.get("agentId", [""])[0])
            found = merged_profile(agent_id)
            if not found or found["profile"].get("name") != name:
                self.send_json({"matched": False})
                return
            self.send_json({
                "matched": True,
                **found,
                "history": conversation_history(agent_id),
                "proposals": proposal_history(agent_id),
                "planningHistory": content_planning_history(agent_id),
                "contentPlans": content_plan_history(agent_id),
                "creativeHistory": creative_tool_history(agent_id),
            })
            return
        self.serve_static(parsed.path)

    def do_POST(self):
        endpoint = urlparse(self.path).path
        if endpoint not in ("/api/profile", "/api/generate", "/api/message", "/api/chat", "/api/content-plan/message", "/api/content-plan/generate", "/api/content-plan/revise", "/api/creative/message", "/api/script/rewrite", "/api/script/intent", "/api/xhs/intent", "/api/xhs/format"):
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        try:
            size = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(size).decode("utf-8"))
            agent_id = clean(payload.get("agentId"))
            profile = payload.get("profile")
            if endpoint in ("/api/message", "/api/content-plan/message", "/api/creative/message"):
                role = clean(payload.get("role"))
                content = clean(payload.get("content"))
                if not agent_id or not role or not content:
                    raise ValueError("Invalid message payload")
                if endpoint == "/api/creative/message":
                    tool = clean(payload.get("tool"))
                    result = payload.get("result") if isinstance(payload.get("result"), dict) else None
                    if tool not in {"script", "xhs"}:
                        raise ValueError("Invalid creative tool")
            elif endpoint == "/api/chat":
                content = clean(payload.get("message"))
                if not isinstance(profile, dict) or not content:
                    raise ValueError("Invalid chat payload")
            elif endpoint in ("/api/content-plan/generate", "/api/content-plan/revise"):
                planning = payload.get("planning")
                revision = clean(payload.get("revision"))
                current_plan = payload.get("currentPlan")
                if not isinstance(profile, dict) or not isinstance(planning, dict):
                    raise ValueError("Invalid content planning payload")
                if endpoint == "/api/content-plan/revise" and (not revision or not isinstance(current_plan, dict)):
                    raise ValueError("Invalid content planning revision payload")
            elif endpoint in ("/api/script/rewrite", "/api/script/intent", "/api/xhs/intent", "/api/xhs/format"):
                source = clean(payload.get("source"))
                revision = clean(payload.get("revision"))
                ip_plan = payload.get("ipPlan") if isinstance(payload.get("ipPlan"), dict) else None
                if not isinstance(profile, dict) or not source or len(source) > 30000:
                    raise ValueError("Invalid creative content payload")
                if endpoint in ("/api/script/intent", "/api/xhs/intent"):
                    content = clean(payload.get("message"))
                    if not content or len(content) > 30000:
                        raise ValueError("Invalid creative intent payload")
            elif not isinstance(profile, dict) or (endpoint == "/api/profile" and not agent_id):
                raise ValueError("Invalid profile payload")
        except (ValueError, json.JSONDecodeError):
            self.send_json({"error": "资料格式不正确"}, HTTPStatus.BAD_REQUEST)
            return
        if endpoint == "/api/generate":
            try:
                generated = deepseek_generate(profile)
                version = save_proposal(agent_id, generated["proposal"], generated["model"]) if agent_id else None
                self.send_json({"ok": True, "version": version, **generated})
            except RuntimeError as error:
                self.send_json({"error": str(error)}, HTTPStatus.BAD_GATEWAY)
            return
        if endpoint == "/api/chat":
            try:
                self.send_json({"ok": True, **deepseek_understand(profile, content)})
            except RuntimeError as error:
                self.send_json({"error": str(error)}, HTTPStatus.BAD_GATEWAY)
            return
        if endpoint == "/api/content-plan/generate" or endpoint == "/api/content-plan/revise":
            try:
                generated = deepseek_content_plan(profile, planning, current_plan if endpoint.endswith("revise") else None, revision)
                version = save_content_plan(agent_id, generated["plan"], generated["model"]) if agent_id else None
                self.send_json({"ok": True, "version": version, **generated})
            except RuntimeError as error:
                self.send_json({"error": str(error)}, HTTPStatus.BAD_GATEWAY)
            return
        if endpoint == "/api/script/rewrite":
            try:
                self.send_json({"ok": True, **deepseek_script_rewrite(profile, ip_plan, source, revision)})
            except RuntimeError as error:
                self.send_json({"error": str(error)}, HTTPStatus.BAD_GATEWAY)
            return
        if endpoint == "/api/script/intent":
            try:
                self.send_json({"ok": True, **deepseek_script_intent(profile, ip_plan, source, content)})
            except RuntimeError as error:
                self.send_json({"error": str(error)}, HTTPStatus.BAD_GATEWAY)
            return
        if endpoint == "/api/xhs/intent":
            try:
                self.send_json({"ok": True, **deepseek_xhs_intent(profile, source, content)})
            except RuntimeError as error:
                self.send_json({"error": str(error)}, HTTPStatus.BAD_GATEWAY)
            return
        if endpoint == "/api/xhs/format":
            try:
                self.send_json({"ok": True, **deepseek_xhs_format(source, revision)})
            except RuntimeError as error:
                self.send_json({"error": str(error)}, HTTPStatus.BAD_GATEWAY)
            return
        if endpoint == "/api/content-plan/message":
            if not save_content_planning_message(agent_id, role, content):
                self.send_json({"error": "无法保存此条内容规划对话"}, HTTPStatus.BAD_REQUEST)
                return
            self.send_json({"saved": True})
            return
        if endpoint == "/api/message":
            if not save_conversation_message(agent_id, role, content):
                self.send_json({"error": "无法保存此条对话"}, HTTPStatus.BAD_REQUEST)
                return
            self.send_json({"saved": True})
            return
        if endpoint == "/api/creative/message":
            if not save_creative_tool_message(agent_id, tool, role, content, result):
                self.send_json({"error": "无法保存此条创作对话"}, HTTPStatus.BAD_REQUEST)
                return
            self.send_json({"saved": True})
            return
        if not agent_id:
            self.send_json({"error": "缺少营销员编号"}, HTTPStatus.BAD_REQUEST)
            return
        if not save_profile(agent_id, profile):
            self.send_json({"error": "未找到该营销员"}, HTTPStatus.NOT_FOUND)
            return
        self.send_json({"saved": True, "profile": merged_profile(agent_id)["profile"]})

    def serve_static(self, request_path):
        relative = "index.html" if request_path in ("", "/") else request_path.lstrip("/")
        target = (WEB_DIR / relative).resolve()
        if WEB_DIR.resolve() not in target.parents and target != WEB_DIR.resolve():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if not target.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        content = target.read_bytes()
        mime, _ = mimetypes.guess_type(target.name)
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", f"{mime or 'application/octet-stream'}; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--import-xlsx", type=Path)
    parser.add_argument("--migrate-sqlite", action="store_true", help="一次性迁移本地 SQLite 历史数据到 PostgreSQL")
    parser.add_argument("--check-db", action="store_true", help="检查当前数据库连接和记录数量")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    load_local_env()
    initialize_database()
    if args.migrate_sqlite:
        print("迁移完成：" + json.dumps(migrate_sqlite_to_postgres(), ensure_ascii=False))
        return
    if args.check_db:
        print("数据库连接正常：" + json.dumps(database_counts(), ensure_ascii=False))
        return
    if args.import_xlsx:
        print(f"已导入 {import_signup_sheet(args.import_xlsx)} 条营销员报名资料。")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), AppHandler)
    print(f"AIA Auto IP MVP 已启动：http://127.0.0.1:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
