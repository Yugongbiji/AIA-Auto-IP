"""Evidence normalization and asset competition for Import Harness V1.

Pure functions only. Facts remain source-traceable; inference never becomes fact.
"""
from __future__ import annotations
import re

RANK={"rare_specific":80,"numeric_experience":70,"contrast_transition":60,"credential_honor":50,
      "peer_stable_trait":40,"life_identity":30,"interest":20,"generic_adjective":10}
SPECIFIC_UPGRADES=(("QS前100",("清华","北大","复旦","交大")),
                   ("985",("清华","北大","复旦","交大","大学")),
                   ("211",("清华","北大","复旦","交大","大学")),
                   ("留学",("美国","英国","澳洲","加拿大","日本","新加坡")),
                   ("宝妈",("一个孩子","两个孩子","儿子","女儿","岁")),
                   ("宝爸",("一个孩子","两个孩子","儿子","女儿","岁")),
                   ("MDRT",("百万","千万","业绩")),
                   ("COT",("百万","千万","业绩")),("TOT",("百万","千万","业绩")))
YEAR_EXACT=re.compile(r"(?<!\d)(\d{1,2})\s*年\+?")
VAGUE_TIME=("多年","长期")

def _e(rule,code,detail=""): return {"ruleId":rule,"code":code,"detail":detail}
def _norm(s): return re.sub(r"[\s，。；、|｜]+","",str(s or "")).lower()

def validate_evidence_ledger(ledger):
    errors=[]; seen={}; conflicts={}
    for item in ledger or []:
        claim=str((item or {}).get("claim") or "").strip()
        source=str((item or {}).get("sourceText") or claim).strip()
        grade=str((item or {}).get("sourceGrade") or "").upper()
        key=str((item or {}).get("factKey") or _norm(claim))
        if grade not in {"A","B","C"}: errors.append(_e("EVID-001","inadmissible_grade",grade))
        # Exact numeric duration cannot be weakened into vague duration.
        m=YEAR_EXACT.search(source)
        if m and any(v in claim for v in VAGUE_TIME) and m.group(1) not in claim:
            errors.append(_e("EVID-003","numeric_duration_weakened",claim))
        if not YEAR_EXACT.search(source) and not any(v in source for v in VAGUE_TIME) and any(v in claim for v in VAGUE_TIME):
            errors.append(_e("EVID-003","duration_invented",claim))
        for category,specifics in SPECIFIC_UPGRADES:
            if category in source and any(x in claim and x not in source for x in specifics):
                errors.append(_e("EVID-009","category_upgraded_to_specific_fact",claim))
        nk=_norm(claim)
        if nk in seen:
            seen[nk]["sources"].append((item or {}).get("sourceField"))
        else:
            seen[nk]={"claim":claim,"sources":[(item or {}).get("sourceField")]}
        if key:
            conflicts.setdefault(key,set()).add(_norm(claim))
    for key,vals in conflicts.items():
        if len({v for v in vals if v})>1:
            errors.append(_e("EVID-007","conflicting_fact_requires_human_resolution",key))
    return errors

def rank_assets(ledger,current_industry_years=None):
    """Return deduplicated, deterministic ranking. Does not generate prose."""
    assets={}
    for item in ledger or []:
        claim=str((item or {}).get("claim") or "").strip()
        if not claim: continue
        key=str((item or {}).get("factKey") or _norm(claim))
        kind=str((item or {}).get("assetType") or "generic_adjective")
        score=RANK.get(kind,0)
        if (item or {}).get("isCurrentIndustry") and current_industry_years is not None and float(current_industry_years)<5:
            score=-1
        row=assets.setdefault(key,{"claim":claim,"assetType":kind,"score":score,"sources":[]})
        row["score"]=max(row["score"],score)
        row["sources"].append((item or {}).get("sourceField"))
    return sorted(assets.values(),key=lambda x:(-x["score"],x["claim"]))
