"""Deterministic XHS formatting contract matching the current product baseline.

This module only changes layout/emoji insertion. It never rewrites source wording.
"""
from __future__ import annotations

import re

_NEUTRAL = ("📌", "💡", "✨", "✅")
_EMOJI_RE = re.compile(r"[\U0001F300-\U0001FAFF\u2600-\u27BF]")
_ISOLATED_PUNCT = re.compile(r"^[\s【】\[\]（）()“”‘’《》〈〉：:，,。！？!?；;、…—-]+$")


def _fix_isolated_punctuation(text: str) -> str:
    """Remove line breaks that leave punctuation/brackets alone on a line."""
    lines = str(text or "").splitlines()
    out: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped and _ISOLATED_PUNCT.fullmatch(stripped) and out:
            out[-1] = out[-1].rstrip() + stripped
        else:
            out.append(line)
    # If an opening bracket is stranded at the end of a line, join the next line.
    merged: list[str] = []
    index = 0
    while index < len(out):
        current = out[index]
        if index + 1 < len(out) and current.rstrip().endswith(("【", "[", "（", "(", "“", "‘", "《", "〈")):
            merged.append(current.rstrip() + out[index + 1].lstrip())
            index += 2
        else:
            merged.append(current)
            index += 1
    return "\n".join(merged)


def _strict_scan_emojis(text: str) -> str:
    """Guarantee every consecutive two sentences contain at least one emoji cue."""
    parts = re.split(r"(?<=[。！？!?])", str(text or ""))
    sentence_indexes = [i for i, part in enumerate(parts) if part.strip()]
    if not sentence_indexes:
        return text
    neutral_index = 0
    for position in range(1, len(sentence_indexes)):
        previous_i = sentence_indexes[position - 1]
        current_i = sentence_indexes[position]
        pair = parts[previous_i] + parts[current_i]
        if _EMOJI_RE.search(pair):
            continue
        current = parts[current_i]
        leading = current[: len(current) - len(current.lstrip())]
        body = current.lstrip()
        parts[current_i] = f"{leading}{_NEUTRAL[neutral_index % len(_NEUTRAL)]} {body}"
        neutral_index += 1
    return "".join(parts)


def install(core_module) -> None:
    if getattr(core_module, "__aia_xhs_contract_installed__", False):
        return
    original_readability = core_module.enforce_xhs_readability

    def readability(text: str) -> str:
        return _fix_isolated_punctuation(original_readability(text))

    core_module.enforce_xhs_readability = readability
    core_module.add_scan_emojis = _strict_scan_emojis
    core_module.__aia_xhs_contract_installed__ = True
