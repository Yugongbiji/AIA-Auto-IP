"""Stable-output promotion decision for Import Harness V1.

This does not write the database. It only returns BLOCK/KEEP/PROMOTE eligibility.
"""
from __future__ import annotations
from backend.persona_contract import validate_output
from backend.evidence_contract import validate_evidence_ledger

ALLOWED_REASONS={"fact_correction","rule_or_compliance_fix","stronger_asset","explicit_user_request"}

def _norm(v):
    if isinstance(v,dict): return {k:_norm(x) for k,x in sorted(v.items()) if k not in {"generatedAt","model","proposalId"}}
    if isinstance(v,list): return [_norm(x) for x in v]
    return str(v or "").strip()

def decide_promotion(current,candidate,*,agent_id="",reason="",quality=None):
    errors=[]
    ledger=(candidate or {}).get("evidenceLedger") or []
    errors.extend(validate_evidence_ledger(ledger))
    errors.extend(validate_output(candidate or {},agent_id=agent_id,production=True))
    if errors:
        return {"decision":"BLOCK","ruleIds":sorted({e["ruleId"] for e in errors}),"errors":errors}
    if current and reason not in ALLOWED_REASONS:
        return {"decision":"KEEP","ruleIds":["STABLE-007"],"reason":"no_allowed_change_reason"}
    if current and _norm(current)==_norm(candidate):
        return {"decision":"KEEP","ruleIds":["STABLE-006"],"reason":"no_substantive_change"}
    if current:
        if not isinstance(quality,dict) or "current" not in quality or "candidate" not in quality:
            return {"decision":"BLOCK","ruleIds":["STABLE-006"],"reason":"strict_quality_comparison_missing"}
        if float(quality["candidate"])<=float(quality["current"]):
            return {"decision":"KEEP","ruleIds":["STABLE-006"],"reason":"candidate_not_strictly_better"}
    return {"decision":"PROMOTE_ELIGIBLE","ruleIds":["STABLE-006","STABLE-007","STABLE-010"]}
