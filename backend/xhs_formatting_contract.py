"""Deterministic XHS formatting contract matching the current product rules.

This module only changes layout/emoji insertion. It never rewrites source wording.
The current dedicated XHS rule keeps emoji density moderate: normally one cue every
2–3 sentences, never an emoji on every sentence just to satisfy a counter.
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


def _cadenced_scan_emojis(text: str) -> str:
    """Keep a moderate 2–3 sentence emoji cadence without changing source wording.

    The model/runtime may already add contextual emoji. This deterministic fallback
    only intervenes when three consecutive sentences contain no emoji at all; it
    adds one neutral cue to the third sentence. It deliberately does *not* enforce
    an emoji in every consecutive pair.
    """
    parts = re.split(r"(?<=[。！？!?])", str(text or ""))
    sentence_indexes = [i for i, part in enumerate(parts) if part.strip()]
    if not sentence_indexes:
        return text

    neutral_index = 0
    emoji_free_run = 0
    for part_index in sentence_indexes:
        if _EMOJI_RE.search(parts[part_index]):
            emoji_free_run = 0
            continue
        emoji_free_run += 1
        if emoji_free_run < 3:
            continue

        current = parts[part_index]
        leading = current[: len(current) - len(current.lstrip())]
        body = current.lstrip()
        parts[part_index] = f"{leading}{_NEUTRAL[neutral_index % len(_NEUTRAL)]} {body}"
        neutral_index += 1
        emoji_free_run = 0

    return "".join(parts)


def install(core_module) -> None:
    if getattr(core_module, "__aia_xhs_contract_installed__", False):
        return
    original_readability = core_module.enforce_xhs_readability

    def readability(text: str) -> str:
        return _fix_isolated_punctuation(original_readability(text))

    core_module.enforce_xhs_readability = readability
    core_module.add_scan_emojis = _cadenced_scan_emojis
    core_module.__aia_xhs_contract_installed__ = True
