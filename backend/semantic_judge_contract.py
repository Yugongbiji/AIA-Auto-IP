"""Build independent, Rule-ID-scoped semantic-judge tasks from frozen PRD."""
from __future__ import annotations
import re
from pathlib import Path
from backend.rule_scope_contract import semantic_candidate_rule_ids
ROOT=Path(__file__).resolve().parents[1]
PRD=ROOT/"docs/product/AIA_IP_PERSONA_PRD_V1.md"
RULE=re.compile(r"^- \*\*((?:NICK|HEAD|BIO|CONTENT)-\d{3})\*\*：(.*)$")
def semantic_rule_texts():
    out={}
    for line in PRD.read_text(encoding="utf-8").splitlines():
        m=RULE.match(line.strip())
        if m: out[m.group(1)]=m.group(2).strip()
    return out
def _judge_view(candidate):
    return {
      "confirmedFacts":candidate.get("confirmedFacts") or candidate.get("profileFacts") or {},
      "evidenceLedger":candidate.get("evidenceLedger") or [],
      "assetRanking":candidate.get("assetRanking") or [],
      "nicknamePreset":candidate.get("nicknamePreset"),
      "nicknameCandidates":candidate.get("nicknameCandidates") or [],
      "nicknamePrimary":candidate.get("nicknamePrimary"),
      "headline":candidate.get("headline"),
      "canonicalBody":candidate.get("personLines") or candidate.get("bioLines") or candidate.get("bodyLines") or
        sum([candidate.get("whoLines") or [],candidate.get("advantageLines") or [],candidate.get("valueLines") or []],[]),
      "services":candidate.get("services") or [],
      "xiaohongshuBio":candidate.get("xiaohongshuBio") or [],
      "videoDouyinBio":candidate.get("videoDouyinBio") or [],
      "primaryGoal":candidate.get("primaryGoal"),
      "contentLines":candidate.get("contentLines") or {},
    }
def build_tasks(candidate,rule_ids=None):
    rules=semantic_rule_texts(); tasks=[]
    requested=semantic_candidate_rule_ids() if rule_ids is None else [r for r in rule_ids if r in semantic_candidate_rule_ids()]
    view=_judge_view(candidate)
    for rid in requested:
        if rid not in rules: continue
        tasks.append({"ruleId":rid,"rule":rules[rid],
          "instruction":"只判断这一条冻结PRD规则，不判断其他规则。只能使用confirmedFacts、Evidence Ledger、Asset Ranking和最终输出；不得补充事实，不得因为文案看起来合理而推定证据存在。若证据不足以证明符合本规则，返回FAIL。必须引用具体输入证据和具体输出片段。返回PASS或FAIL，并给出非空evidence和reason。",
          "candidate":view,
          "outputSchema":{"ruleId":rid,"status":"PASS|FAIL","evidence":"必须引用具体事实/证据/输出片段","reason":"说明为何满足或违反本Rule ID"}})
    return tasks
