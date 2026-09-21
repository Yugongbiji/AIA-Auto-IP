"""Scope-aware PRD executor planning.

Release/journey rules are evaluated once per release, batch/data rules once per
batch, and persona/content semantic rules per candidate. Deterministic rules are
not re-requested from semantic executors.
"""
from __future__ import annotations
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ENFORCEMENT=json.loads((ROOT/"contracts/aia_ip_persona_enforcement_v1.json").read_text(encoding="utf-8"))
MANIFEST=json.loads((ROOT/"contracts/aia_ip_persona_pending_executors_v1.json").read_text(encoding="utf-8"))
RELEASE_EXECUTORS={"architecture_contract","journey_contract"}
BATCH_EXECUTORS={"data_contract"}
CANDIDATE_EXECUTORS={"semantic_judge","compliance_contract","contract_assertion"}

def executable_rule_ids():
    return {rid for rid,spec in ENFORCEMENT["rules"].items() if spec.get("status")=="executable-v1"}

def rules_for_scope(scope):
    allowed={"release":RELEASE_EXECUTORS,"batch":BATCH_EXECUTORS,"candidate":CANDIDATE_EXECUTORS}.get(scope,set())
    executable=executable_rule_ids()
    return sorted(rid for rid,spec in MANIFEST["rules"].items()
                  if rid in executable and spec.get("executor") in allowed)

def semantic_candidate_rule_ids():
    return sorted(rid for rid in rules_for_scope("candidate")
                  if MANIFEST["rules"][rid].get("executor")=="semantic_judge")
