"""Build independent semantic-judge tasks from frozen PRD text."""
from __future__ import annotations
import re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PRD=ROOT/"docs/product/AIA_IP_PERSONA_PRD_V1.md"
RULE=re.compile(r"^- \*\*((?:NICK|HEAD|BIO|CONTENT)-\d{3})\*\*：(.*)$")

def semantic_rule_texts():
    out={}
    for line in PRD.read_text(encoding="utf-8").splitlines():
        m=RULE.match(line.strip())
        if m: out[m.group(1)]=m.group(2).strip()
    return out

def build_tasks(candidate,rule_ids):
    rules=semantic_rule_texts(); tasks=[]
    for rid in rule_ids:
        if rid not in rules: continue
        tasks.append({"ruleId":rid,"rule":rules[rid],
          "instruction":"只判断这一条冻结PRD规则。只能依据candidate中的事实、Evidence Ledger、Asset Ranking和最终输出。不得补充事实。返回PASS或FAIL，并给出具体evidence和reason。",
          "candidate":candidate,
          "outputSchema":{"ruleId":rid,"status":"PASS|FAIL","evidence":"非空","reason":"非空"}})
    return tasks
