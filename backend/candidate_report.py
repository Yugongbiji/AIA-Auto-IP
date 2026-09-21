"""Candidate report builder for batch import review. No writes."""
from __future__ import annotations
from backend.import_contract import validate_package
from backend.persona_contract import validate_output
from backend.evidence_contract import rank_assets
from backend.stable_promotion_contract import decide_promotion

def build_candidate_report(data):
    package_errors=validate_package(data)
    existing=data.get("existingCurrentOutputs") or {}
    stable=data.get("stableOutputs") or {}
    quality=data.get("qualityComparisons") or {}
    reasons=data.get("changeReasons") or {}
    rows=[]
    for agent_id,candidate in stable.items():
        hard=validate_output(candidate,agent_id=str(agent_id),production=True)
        assets=rank_assets(candidate.get("evidenceLedger") or [],candidate.get("currentIndustryYears"))
        current=existing.get(agent_id)
        promotion=decide_promotion(current,candidate,agent_id=str(agent_id),
                                   reason=reasons.get(agent_id,""),
                                   quality=quality.get(agent_id),
                                   incremental=True)
        relevant_pkg=[e for e in package_errors if not e.get("agentId") or e.get("agentId")==str(agent_id)]
        rule_ids=sorted({e["ruleId"] for e in relevant_pkg+hard} | set(promotion.get("ruleIds") or []))
        state="BLOCKED" if relevant_pkg or hard or promotion["decision"]=="BLOCK" else (
              "KEEP" if promotion["decision"]=="KEEP" else "READY")
        rows.append({"agentId":str(agent_id),"state":state,"ruleIds":rule_ids,
                     "topAssets":[x["claim"] for x in assets if x["score"]>=0][:5],
                     "hardErrors":hard,"packageErrors":relevant_pkg,"promotion":promotion})
    return {"mode":"candidate-report","productionWrite":False,
            "summary":{"candidates":len(rows),"ready":sum(x["state"]=="READY" for x in rows),
                       "keep":sum(x["state"]=="KEEP" for x in rows),
                       "blocked":sum(x["state"]=="BLOCKED" for x in rows)},
            "candidates":rows}
