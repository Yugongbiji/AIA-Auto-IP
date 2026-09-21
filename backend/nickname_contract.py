"""Deterministic nickname gates for frozen PRD NICK rules.

Semantic creativity may propose candidates, but it does not own final ordering.
"""
from __future__ import annotations
import re

BAD_EMPTY={"","无","暂无","没有","0","未设置"}
UNIVERSAL=("的小世界","的日常","聊生活","看世界")
BANNED_BRAND=re.compile(r"保险|友邦|友邦保险|友邦人寿|AIA",re.I)
DECORATION=re.compile(r"[✨🌟⭐❤❤️💖💫🌈🔥🎯]")
MEANINGLESS_DIGITS=re.compile(r"\d+$")

def _s(v): return str(v or "").strip()
def _err(r,c,d=""): return {"ruleId":r,"code":c,"detail":d}

def memory_score(row):
    score=0
    if row.get("matureProtectedOriginal"): score+=3
    if row.get("hasCurrentDistinctiveTrait"): score+=3
    if row.get("isRealHighFrequencyAnchor"): score+=2
    if row.get("hasEvidenceDistinctiveModifier"): score+=2
    if row.get("isBareAnchor"): score+=0
    name=_s(row.get("nickname"))
    if MEANINGLESS_DIGITS.search(name): score-=2
    if row.get("allEnglish") and MEANINGLESS_DIGITS.search(name): score-=1
    if any(x in name for x in UNIVERSAL): score-=5
    return score

def validate_nickname_output(output):
    errors=[]
    rows=output.get("nicknameCandidates") or []
    primary=_s(output.get("nicknamePrimary"))
    if not isinstance(rows,list) or not rows:
        return [_err("NICK-011","nickname_candidates_missing")]
    names=[_s(x.get("nickname")) for x in rows if isinstance(x,dict)]
    if primary not in names: errors.append(_err("NICK-021","primary_not_in_controlled_candidates",primary))
    for row in rows:
        if not isinstance(row,dict): continue
        name=_s(row.get("nickname"))
        if name in BAD_EMPTY: errors.append(_err("NICK-017","missing_value_used_as_nickname",name))
        if DECORATION.search(name): errors.append(_err("NICK-029","nickname_decoration_not_cleaned",name))
        if BANNED_BRAND.search(name) and not row.get("matureProtectedOriginal"):
            errors.append(_err("NICK-023","new_nickname_contains_brand_or_business",name))
        if any(x in name for x in UNIVERSAL) and not row.get("matureProtectedOriginal"):
            errors.append(_err("NICK-010","universal_template_nickname",name))
        if row.get("isBareAnchor") and row.get("hasDistinctiveModifier"):
            errors.append(_err("NICK-014","bare_anchor_metadata_conflict",name))
        declared=row.get("memoryScore")
        actual=memory_score(row)
        if declared is None or declared!=actual:
            errors.append(_err("NICK-014","memory_score_mismatch",f"{name}:{declared}!={actual}"))
    if rows:
        eligible=[x for x in rows if isinstance(x,dict) and _s(x.get("nickname")) not in BAD_EMPTY]
        distinctive=[x for x in eligible if (x.get("hasEvidenceDistinctiveModifier") or x.get("hasCurrentDistinctiveTrait")) and not x.get("isBareAnchor")]
        p=next((x for x in eligible if _s(x.get("nickname"))==primary),None)
        if p and p.get("isBareAnchor") and distinctive:
            errors.append(_err("NICK-012","bare_anchor_cannot_be_primary_when_distinctive_candidate_exists",primary))
            errors.append(_err("NICK-015","higher_priority_distinctive_candidate_exists",primary))
        if p and eligible:
            max_score=max(memory_score(x) for x in eligible)
            if memory_score(p)<max_score:
                errors.append(_err("NICK-015","primary_not_highest_memory_score",primary))
        if not any(x.get("isBareAnchor") for x in eligible):
            errors.append(_err("NICK-027","missing_safe_real_anchor_backup"))
    return errors
