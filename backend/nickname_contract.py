"""Deterministic nickname gates for frozen PRD NICK rules."""
from __future__ import annotations
import re
BAD_EMPTY={"","无","暂无","没有","0","未设置"}
UNIVERSAL=("的小世界","的日常","聊生活","看世界")
BANNED_BRAND=re.compile(r"保险|友邦|友邦保险|友邦人寿|AIA",re.I)
DECORATION=re.compile(r"[✨🌟⭐❤💖💫🌈🔥🎯]")
MEANINGLESS_DIGITS=re.compile(r"\d+$")
ALLOWED_CONNECTORS={"说","聊","讲","谈","看"}
EXAGGERATED=("第一","最强","顶级","一哥","大师","权威")
def _s(v): return str(v or "").strip()
def _err(r,c,d=""): return {"ruleId":r,"code":c,"detail":d}
def memory_score(row):
    score=0
    if row.get("matureProtectedOriginal"): score+=3
    if row.get("hasCurrentDistinctiveTrait"): score+=3
    if row.get("isRealHighFrequencyAnchor"): score+=2
    if row.get("hasEvidenceDistinctiveModifier"): score+=2
    name=_s(row.get("nickname"))
    if MEANINGLESS_DIGITS.search(name): score-=2
    if row.get("allEnglish"): score-=3
    if any(x in name for x in UNIVERSAL): score-=5
    return score
def validate_nickname_output(output):
    errors=[]; rows=output.get("nicknameCandidates") or []; primary=_s(output.get("nicknamePrimary"))
    if not isinstance(rows,list) or not rows: return [_err("NICK-011","nickname_candidates_missing")]
    names=[_s(x.get("nickname")) for x in rows if isinstance(x,dict)]
    if primary not in names: errors.append(_err("NICK-021","primary_not_in_controlled_candidates",primary))
    for row in rows:
        if not isinstance(row,dict): continue
        name=_s(row.get("nickname"))
        if name in BAD_EMPTY: errors.append(_err("NICK-017","missing_value_used_as_nickname",name))
        if DECORATION.search(name): errors.append(_err("NICK-029","nickname_decoration_not_cleaned",name))
        if BANNED_BRAND.search(name) and not row.get("matureProtectedOriginal"): errors.append(_err("NICK-023","new_nickname_contains_brand_or_business",name))
        if any(x in name for x in UNIVERSAL) and not row.get("matureProtectedOriginal"): errors.append(_err("NICK-010","universal_template_nickname",name))
        if row.get("sourceType")=="pastCareer": errors.append(_err("NICK-007","past_career_used_as_new_nickname_route",name))
        if row.get("route")=="interest" and not row.get("evidenceRefs"): errors.append(_err("NICK-013","interest_nickname_without_evidence",name))
        if row.get("route") in {"identity","trait","region","professional","education","achievement"} and not row.get("evidenceRefs"): errors.append(_err("NICK-019","controlled_route_without_evidence",name))
        if any(x in name for x in EXAGGERATED) and not row.get("matureProtectedOriginal"): errors.append(_err("NICK-019","exaggerated_nickname_claim",name))
        if row.get("connector") and row.get("connector") not in ALLOWED_CONNECTORS: errors.append(_err("NICK-020","unapproved_connector",str(row.get("connector"))))
        if row.get("sourceTier")=="ai" and not row.get("controlledCandidatesInsufficient"): errors.append(_err("NICK-022","ai_candidate_used_before_controlled_candidates_exhausted",name))
        if row.get("isBareAnchor") and row.get("hasDistinctiveModifier"): errors.append(_err("NICK-014","bare_anchor_metadata_conflict",name))
        actual=memory_score(row)
        if row.get("memoryScore") is None or row.get("memoryScore")!=actual: errors.append(_err("NICK-014","memory_score_mismatch",f"{name}:{row.get('memoryScore')}!={actual}"))
    preset=output.get("nicknamePreset") or {}
    if preset.get("status")=="approved" and primary!=_s(preset.get("primary")): errors.append(_err("NICK-005","approved_primary_not_preserved",primary))
    eligible=[x for x in rows if isinstance(x,dict) and _s(x.get("nickname")) not in BAD_EMPTY]
    distinctive=[x for x in eligible if (x.get("hasEvidenceDistinctiveModifier") or x.get("hasCurrentDistinctiveTrait")) and not x.get("isBareAnchor")]
    p=next((x for x in eligible if _s(x.get("nickname"))==primary),None)
    if p and p.get("isBareAnchor") and distinctive:
        errors += [_err("NICK-012","bare_anchor_cannot_be_primary_when_distinctive_candidate_exists",primary),_err("NICK-015","higher_priority_distinctive_candidate_exists",primary)]
    tiers={"approved-primary":0,"approved-backup":1,"controlled":2,"ai":3}
    if p and eligible:
        best_tier=min(tiers.get(str(x.get("sourceTier") or "controlled"),2) for x in eligible)
        if tiers.get(str(p.get("sourceTier") or "controlled"),2)>best_tier: errors.append(_err("NICK-026","primary_violates_candidate_source_order",primary))
        max_score=max(memory_score(x) for x in eligible if tiers.get(str(x.get("sourceTier") or "controlled"),2)==best_tier)
        if tiers.get(str(p.get("sourceTier") or "controlled"),2)==best_tier and memory_score(p)<max_score: errors.append(_err("NICK-015","primary_not_highest_memory_score",primary))
    if not any(x.get("isBareAnchor") for x in eligible): errors.append(_err("NICK-027","missing_safe_real_anchor_backup"))
    return errors
