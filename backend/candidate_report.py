"""Candidate report builder for batch import review. No writes."""
from __future__ import annotations
from backend.import_contract import validate_package
from backend.persona_contract import validate_output
from backend.evidence_contract import rank_assets
from backend.stable_promotion_contract import decide_promotion
from backend.prd_rule_executor import validate_executor_results
from backend.semantic_judge_contract import build_tasks
from backend.nickname_contract import validate_nickname_output
from backend.rule_scope_contract import rules_for_scope, semantic_candidate_rule_ids

def build_candidate_report(data):
    package_errors=validate_package(data)
    existing=data.get("existingCurrentOutputs") or {}
    stable=data.get("stableOutputs") or {}
    quality=data.get("qualityComparisons") or {}
    reasons=data.get("changeReasons") or {}
    executor_results=data.get("ruleExecutorResults") or {}
    release_results=data.get("releaseRuleExecutorResults") or []
    batch_results=data.get("batchRuleExecutorResults") or []
    release_gate=validate_executor_results(release_results,required_rule_ids=rules_for_scope("release"))
    batch_gate=validate_executor_results(batch_results,required_rule_ids=rules_for_scope("batch"))
    rows=[]
    for agent_id,candidate in stable.items():
        hard=validate_output(candidate,agent_id=str(agent_id),production=True) + validate_nickname_output(candidate)
        assets=rank_assets(candidate.get("evidenceLedger") or [],candidate.get("currentIndustryYears"))
        current=existing.get(agent_id)
        promotion=decide_promotion(current,candidate,agent_id=str(agent_id),
                                   reason=reasons.get(agent_id,""),
                                   quality=quality.get(agent_id),
                                   incremental=True)
        semantic_tasks=build_tasks(candidate,semantic_candidate_rule_ids())
        extra=validate_executor_results(executor_results.get(str(agent_id),[]),required_rule_ids=rules_for_scope("candidate"))
        relevant_pkg=[e for e in package_errors if not e.get("agentId") or e.get("agentId")==str(agent_id)]
        rule_ids=sorted({e["ruleId"] for e in relevant_pkg+hard+extra["errors"]+release_gate["errors"]+batch_gate["errors"]} | set(promotion.get("ruleIds") or []))
        state="BLOCKED" if relevant_pkg or hard or release_gate["blocked"] or batch_gate["blocked"] or extra["blocked"] or promotion["decision"]=="BLOCK" else (
              "KEEP" if promotion["decision"]=="KEEP" else "READY")
        rows.append({"agentId":str(agent_id),"state":state,"ruleIds":rule_ids,
                     "topAssets":[x["claim"] for x in assets if x["score"]>=0][:5],
                     "hardErrors":hard,"packageErrors":relevant_pkg,"releaseExecutorErrors":release_gate["errors"],"batchExecutorErrors":batch_gate["errors"],"executorErrors":extra["errors"],"semanticTasks":semantic_tasks,"promotion":promotion})
    return {"mode":"candidate-report","productionWrite":False,
            "summary":{"candidates":len(rows),"ready":sum(x["state"]=="READY" for x in rows),
                       "keep":sum(x["state"]=="KEEP" for x in rows),
                       "blocked":sum(x["state"]=="BLOCKED" for x in rows)},
            "candidates":rows}
