"""Runtime IP generation adapter.

Product guidance lives in prompts/ip-persona-prompt.md. This module only adds the
technical JSON response schema and installs the generator onto server.py so the
running service cannot drift onto a second hard-coded product prompt.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
PROMPT_PATH = ROOT / "prompts" / "ip-persona-prompt.md"
API_URL = "https://api.deepseek.com/chat/completions"

OUTPUT_SCHEMA = r"""

# 技术输出结构（不是第二套产品规则）
只输出一个合法 JSON 对象，不要 Markdown。字段结构：
{
  "headline":"一句话定位",
  "subheadline":"补充说明",
  "tags":["短标签"],
  "clientPortrait":{"title":"目标人群标题","text":"描述"},
  "advantages":[{"emoji":"✨","title":"短标题","text":"真实证据说明"}],
  "nicknameOptions":[{"name":"昵称","angle":"侧重点","reason":"理由"}],
  "bios":{
    "xiaohongshu":[{"label":"方案 A · 专业背书","focus":"侧重点","lines":["文案行"]},{"label":"方案 B · 人设记忆","focus":"侧重点","lines":["文案行"]},{"label":"方案 C · 价值服务","focus":"侧重点","lines":["文案行"]}],
    "videoDouyin":[{"label":"方案 A · 专业背书","focus":"侧重点","lines":["文案行"]},{"label":"方案 B · 人设记忆","focus":"侧重点","lines":["文案行"]},{"label":"方案 C · 价值服务","focus":"侧重点","lines":["文案行"]}]
  },
  "platformReminders":[]
}
资料不足时字段可少写或留空，但绝不能创造事实。前端 canonical policy 会对最终业务字段做确定性标准化。
"""


def prompt_text() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8").strip() + OUTPUT_SCHEMA


def generate(profile: dict) -> dict:
    api_key = str(os.getenv("DEEPSEEK_API_KEY", "")).strip()
    if not api_key:
        raise RuntimeError("未配置 DEEPSEEK_API_KEY。请在项目根目录的 .env 文件中填写密钥后重试。")
    payload = {
        "model": os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash"),
        "thinking": {"type": "disabled"},
        "max_tokens": 3000,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": prompt_text()},
            {"role": "user", "content": "营销员资料如下：\n" + json.dumps(profile or {}, ensure_ascii=False, indent=2)},
        ],
    }
    request = Request(
        API_URL,
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


def install(core_module) -> None:
    core_module.deepseek_generate = generate
    core_module.__aia_ip_prompt_path__ = str(PROMPT_PATH)
