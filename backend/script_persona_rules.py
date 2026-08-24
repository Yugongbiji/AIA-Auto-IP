"""Script rewrite persona contract: make account tone explicit and add format resilience."""
from __future__ import annotations

import sys
import time


FORMAT_FAILURE_MARKERS = ("改写格式不完整", "没有返回", "改写稿不完整")


def _text(value) -> str:
    return str(value or "").strip()


def account_tone(profile: dict | None) -> str:
    profile = profile or {}
    for key in ("contentTone", "accountTone", "账号表达风格", "希望呈现的气质"):
        value = _text(profile.get(key))
        if value:
            return value
    return ""


def prepare_profile(profile: dict | None) -> tuple[dict, str]:
    prepared = dict(profile or {})
    tone = account_tone(prepared)
    if tone:
        prepared["scriptStyleInstruction"] = (
            f"账号表达风格已确认：{tone}。脚本改写时必须把它作为长期表达偏好；"
            "轻话题正常体现，专业或严肃题材降低幽默、犀利等强度，不能改变事实、专业信息或合规边界。"
        )
    return prepared, tone


def enrich_breakdown(result: dict, tone: str) -> dict:
    if not isinstance(result, dict) or not tone:
        return result
    breakdown = result.get("breakdown")
    if not isinstance(breakdown, dict):
        breakdown = {}
        result["breakdown"] = breakdown
    current = _text(breakdown.get("ipUse"))
    prefix = f"已代入账号表达风格“{tone}”"
    if tone not in current:
        current = f"{prefix}；{current}" if current else f"{prefix}，并按稿件题材调整表达强度。"
    breakdown["ipUse"] = current[:160]
    return result


def _call_with_format_retry(original, prepared, ip_plan, source, revision):
    try:
        return original(prepared, ip_plan, source, revision)
    except RuntimeError as error:
        message = str(error)
        if not any(marker in message for marker in FORMAT_FAILURE_MARKERS):
            raise
        print(f"[script-rewrite] structured output invalid; retrying once: {message}", file=sys.stderr)
        time.sleep(0.2)
        try:
            return original(prepared, ip_plan, source, revision)
        except RuntimeError as retry_error:
            retry_message = str(retry_error)
            if any(marker in retry_message for marker in FORMAT_FAILURE_MARKERS):
                raise RuntimeError("模型本次返回格式异常，系统已自动重试一次仍未恢复，请稍后再试。") from retry_error
            raise


def install(core_module) -> None:
    if getattr(core_module.deepseek_script_rewrite, "__aia_persona_contract__", False):
        return
    original = core_module.deepseek_script_rewrite

    def wrapped(profile: dict, ip_plan: dict | None, source: str, revision: str = ""):
        prepared, tone = prepare_profile(profile)
        result = _call_with_format_retry(original, prepared, ip_plan, source, revision)
        return enrich_breakdown(result, tone)

    wrapped.__aia_persona_contract__ = True
    wrapped.__name__ = getattr(original, "__name__", "deepseek_script_rewrite")
    core_module.deepseek_script_rewrite = wrapped
