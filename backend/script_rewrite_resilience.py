"""Resilience wrapper for script rewrite model-format failures.

Only retries once when DeepSeek returned malformed/incomplete structured output.
Network/auth/other runtime failures are preserved as-is so we do not hide root causes.
"""
from __future__ import annotations

import sys
import time


FORMAT_FAILURE_MARKERS = (
    "改写格式不完整",
    "没有返回",
    "改写稿不完整",
)


def install(core):
    original = core.deepseek_script_rewrite
    if getattr(original, "_aia_resilience_v1", False):
        return

    def resilient(profile: dict, ip_plan: dict | None, source: str, revision: str = ""):
        try:
            return original(profile, ip_plan, source, revision)
        except RuntimeError as error:
            message = str(error)
            if not any(marker in message for marker in FORMAT_FAILURE_MARKERS):
                raise
            print(f"[script-rewrite] DeepSeek structured output invalid; retrying once: {message}", file=sys.stderr)
            time.sleep(0.2)
            try:
                return original(profile, ip_plan, source, revision)
            except RuntimeError as retry_error:
                retry_message = str(retry_error)
                if any(marker in retry_message for marker in FORMAT_FAILURE_MARKERS):
                    raise RuntimeError("模型本次返回格式异常，系统已自动重试一次仍未恢复，请稍后再试。") from retry_error
                raise

    resilient._aia_resilience_v1 = True
    core.deepseek_script_rewrite = resilient
