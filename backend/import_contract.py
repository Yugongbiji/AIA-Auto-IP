"""Fail-closed import-package gates derived from frozen PRD.

Side-effect free: validates normalized batch JSON only. No DB connection and no writes.
"""
from __future__ import annotations
import re

FROZEN_PRD_COMMIT="c0255a6467e9deaa5daf1c522ab3cecdb603063d"
FROZEN_PRD_BLOB="6cac1ca714ac7fe72ddc1796aed3a1d43e55fdd6"
GOALS={"customer_acquisition","recruitment"}
AGENT_ID=re.compile(r"^\d{9}$")
SELF_MEDIA_TERMS=("粉丝","播放量","点赞量","作品量","留资量","自媒体成交","自媒体获客","自媒体增员")
INTERNAL_JARGON=("A1","PA转任","团队1+2")
FACT_FIELDS={"services","education","previousCareer","hobbies","familyIdentity","currentIndustryYears","honors","city"}
PEER_DERIVED_FIELDS={"peerReviewSummary","peerReviewKeywords"}

def err(rule,code,agent_id="",detail=""):
    x={"ruleId":rule,"code":code}
    if agent_id: x["agentId"]=agent_id
    if detail: x["detail"]=detail
    return x

def aid(row):
    return str((row or {}).get("agentId") or (row or {}).get("agent_id") or "").strip()

def text_of(value):
    if isinstance(value,dict): return "\n".join(text_of(v) for v in value.values())
    if isinstance(value,list): return "\n".join(text_of(v) for v in value)
    return str(value or "")

def validate_package(data:dict):
    errors=[]
    meta=data.get("contract") or data.get("metadata") or {}
    if meta.get("prdCommit")!=FROZEN_PRD_COMMIT or meta.get("prdBlobSha")!=FROZEN_PRD_BLOB:
        errors.append(err("GOV-001","frozen_prd_provenance_mismatch"))

    agents=data.get("agents") or []
    roster_ids=[]
    for row in agents:
        agent_id=aid(row)
        if not AGENT_ID.fullmatch(agent_id):
            errors.append(err("DATA-012","agent_id_not_9_digits",agent_id or "<missing>"))
        if agent_id: roster_ids.append(agent_id)
        goal=str(row.get("primaryGoal") or "").strip()
        if goal and goal not in GOALS:
            errors.append(err("DATA-004","primary_goal_not_normalized",agent_id,goal))
        # Explicitly forbid peer-review aggregates from masquerading as first-party facts.
        facts=row.get("facts")
        if isinstance(facts,dict):
            for k in PEER_DERIVED_FIELDS:
                v=facts.get(k)
                if v:
                    errors.append(err("DATA-005","peer_review_stored_inside_first_party_facts",agent_id,k))

    roster=set(roster_ids)
    reviews=data.get("reviews") or data.get("peerReviews") or []
    skipped=data.get("skippedReviews") or []
    for row in reviews:
        review_id=aid(row)
        if review_id and review_id not in roster:
            errors.append(err("DATA-020","matched_review_has_no_roster_agent",review_id))
    for row in skipped:
        skipped_id=aid(row)
        if skipped_id and skipped_id in roster:
            errors.append(err("DATA-020","skipped_review_would_create_or_collide_agent",skipped_id))

    # Facts and generated outputs must stay separate. Generated outputs may not
    # contain operational social-media performance or internal rank jargon.
    stable=data.get("stableOutputs") or {}
    for agent_id,out in stable.items():
        rendered=text_of(out)
        for term in SELF_MEDIA_TERMS:
            if term in rendered:
                errors.append(err("DATA-003","self_media_metric_used_as_persona_asset",str(agent_id),term))
        for term in INTERNAL_JARGON:
            if term in rendered:
                errors.append(err("EVID-006","internal_jargon_used_as_persona_asset",str(agent_id),term))

    # Import preparation may append proposals, but cannot request destructive
    # replacement of stable/history. Promotion remains a later explicit action.
    policy=data.get("writePolicy") or {}
    if policy.get("overwriteProposal") is True or policy.get("deleteHistoricalProposals") is True:
        errors.append(err("STABLE-003","proposal_history_mutation_requested"))
    if policy.get("overwriteCurrent") is True:
        errors.append(err("STABLE-005","direct_current_output_overwrite_requested"))
    if policy.get("productionWrite") is True:
        errors.append(err("STABLE-005","preflight_package_requests_production_write"))

    return errors
