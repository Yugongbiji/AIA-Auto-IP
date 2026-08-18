"""AIA Auto IP internal MVP server.

Run:
    python server.py --import-xlsx data/何不团队报名表20260807.xlsx

The browser only receives the profile returned by an exact name + agent ID match.
Guest profiles stay in the browser session and are never written to SQLite.
"""

from __future__ import annotations

import argparse
import json
import os
import mimetypes
import sqlite3
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


def load_local_env():
    """Load local development secrets without a third-party dependency."""
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
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
  "nicknameOptions":[{"name":"中文昵称","angle":"专业感/温暖感/地域感等","reason":"不超过30字"}],
  "bios":{
    "xiaohongshu":[{"label":"方案 A · 专业背书","focus":"不超过18字","lines":["每行是一条可复制文案"]},{"label":"方案 B · 温暖陪伴","focus":"不超过18字","lines":["每行是一条可复制文案"]}],
    "videoDouyin":[{"label":"方案 A · 专业背书","focus":"不超过18字","lines":["每行是一条可复制文案"]},{"label":"方案 B · 温暖陪伴","focus":"不超过18字","lines":["每行是一条可复制文案"]}]
  },
  "platformReminders":["小红书个人简介：7 天限修改 3 次（频繁修改影响账号权重）","视频号昵称：每年最多可修改 5 次","微信视频号简介：暂无明确修改次数限制"]
}

具体要求：
1. tags 必须正好 3 个；advantages 输出 3 到 4 条；nicknameOptions 输出 3 到 5 个。
2. 昵称以中文为主，避免英文和拼音。学历只在名校、硕士及以上、博士或留学背景时突出。
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
你的工作是理解口语化表达，找出其中明确要求更新的资料；不要猜测、不要擅自改资料。直接称呼单个营销员时使用亲切自然的“亲”或姓名，不称“红人”；“友邦红人”仅用于描述这个群体或项目，例如“友邦红人计划”。不要使用“用户”“客户”等泛化称呼。语气自然、亲切、轻松，可以有一点恰到好处的小幽默，但不要油腻、不要夸张、不要编造经历。

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


def clean(value):
    if value is None:
        return ""
    return str(value).strip()


def database():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def initialize_database():
    DATA_DIR.mkdir(exist_ok=True)
    with database() as conn:
        conn.executescript(
            """
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
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(agent_id) REFERENCES agents(agent_id)
            );
            CREATE INDEX IF NOT EXISTS idx_conversation_messages_agent_id
                ON conversation_messages(agent_id, id);
            CREATE TABLE IF NOT EXISTS proposals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id TEXT NOT NULL,
                version INTEGER NOT NULL,
                proposal_json TEXT NOT NULL,
                model TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(agent_id) REFERENCES agents(agent_id),
                UNIQUE(agent_id, version)
            );
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
    if "简单的自我介绍" in header:
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
            conn.execute(
                """
                INSERT INTO agents(agent_id, name, survey_json, imported_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(agent_id) DO UPDATE SET
                  name=excluded.name,
                  survey_json=excluded.survey_json,
                  imported_at=excluded.imported_at
                """,
                (record["agentId"], record["name"], json.dumps(record, ensure_ascii=False), now),
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
        version = conn.execute(
            "SELECT COALESCE(MAX(version), 0) + 1 FROM proposals WHERE agent_id = ?", (agent_id,)
        ).fetchone()[0]
        conn.execute(
            """
            INSERT INTO proposals(agent_id, version, proposal_json, model, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (agent_id, version, json.dumps(proposal, ensure_ascii=False), model, now),
        )
    return version


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
            self.send_json({"matched": True, **found, "history": conversation_history(agent_id), "proposals": proposal_history(agent_id)})
            return
        self.serve_static(parsed.path)

    def do_POST(self):
        endpoint = urlparse(self.path).path
        if endpoint not in ("/api/profile", "/api/generate", "/api/message", "/api/chat"):
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        try:
            size = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(size).decode("utf-8"))
            agent_id = clean(payload.get("agentId"))
            profile = payload.get("profile")
            if endpoint == "/api/message":
                role = clean(payload.get("role"))
                content = clean(payload.get("content"))
                if not agent_id or not role or not content:
                    raise ValueError("Invalid message payload")
            elif endpoint == "/api/chat":
                content = clean(payload.get("message"))
                if not isinstance(profile, dict) or not content:
                    raise ValueError("Invalid chat payload")
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
        if endpoint == "/api/message":
            if not save_conversation_message(agent_id, role, content):
                self.send_json({"error": "无法保存此条对话"}, HTTPStatus.BAD_REQUEST)
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
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    load_local_env()
    initialize_database()
    if args.import_xlsx:
        print(f"已导入 {import_signup_sheet(args.import_xlsx)} 条营销员报名资料。")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), AppHandler)
    print(f"AIA Auto IP MVP 已启动：http://127.0.0.1:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()

