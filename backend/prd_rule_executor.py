"""Unified executor for PRD rules not expressible as simple deterministic gates.

No rule may default PASS. Semantic/journey/architecture results must be supplied by
their independent executor and include evidence + reason. Missing/malformed = BLOCK.
"""
from __future__ import annotations
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
MANIFEST=json.loads((ROOT/"contracts/aia_ip_persona_pending_executors_v1.json").read_text(encoding="utf-8"))

def validate_executor_results(results,*,required_rule_ids=None):
    by_id={str(x.get("ruleId")):x for x in (results or []) if isinstance(x,dict)}
    required=set(required_rule_ids or MANIFEST["rules"].keys())
    errors=[]; passes=[]
    for rid in sorted(required):
        spec=MANIFEST["rules"].get(rid)
        if not spec:
            errors.append({"ruleId":rid,"code":"executor_not_registered"}); continue
        row=by_id.get(rid)
        if not row:
            errors.append({"ruleId":rid,"code":"executor_result_missing","executor":spec["executor"]}); continue
        if row.get("status") not in {"PASS","FAIL"} or not str(row.get("evidence") or "").strip() or not str(row.get("reason") or "").strip():
            errors.append({"ruleId":rid,"code":"executor_result_malformed","executor":spec["executor"]}); continue
        if row["status"]=="FAIL":
            errors.append({"ruleId":rid,"code":"rule_failed","executor":spec["executor"],"evidence":row["evidence"],"reason":row["reason"]})
        else: passes.append(rid)
    unknown=sorted(set(by_id)-set(MANIFEST["rules"]))
    for rid in unknown: errors.append({"ruleId":rid,"code":"unknown_executor_result"})
    return {"passed":passes,"errors":errors,"blocked":bool(errors)}
