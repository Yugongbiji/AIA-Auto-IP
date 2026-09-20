#!/usr/bin/env python3
"""Fail-closed coverage check between frozen PRD and machine contract."""
from __future__ import annotations
import hashlib, json, re, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CONTRACT=ROOT/"contracts/aia_ip_persona_contract_v1.json"
ENFORCEMENT=ROOT/"contracts/aia_ip_persona_enforcement_v1.json"

def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(f"blob {len(data)}\0".encode()+data).hexdigest()

def main() -> int:
    contract=json.loads(CONTRACT.read_text(encoding="utf-8"))
    prd_path=ROOT/contract["prd"]["path"]
    raw=prd_path.read_bytes()
    text=raw.decode("utf-8")
    prd_ids=re.findall(r"\*\*([A-Z]+-\d{3})\*\*", text)
    contract_ids=[rid for scope in contract["scopes"].values() for rid in scope["ids"]]
    enforcement=json.loads(ENFORCEMENT.read_text(encoding="utf-8"))
    enforcement_ids=list(enforcement.get("rules",{}))
    missing=sorted(set(prd_ids)-set(contract_ids))
    unknown=sorted(set(contract_ids)-set(prd_ids))
    duplicates=sorted({x for x in contract_ids if contract_ids.count(x)>1})
    blob=git_blob_sha(raw)
    expected=contract["prd"]["gitBlobSha"]
    report={"prdRules":len(prd_ids),"contractRules":len(contract_ids),"missing":missing,
            "unknown":unknown,"duplicates":duplicates,"prdBlob":blob,
            "expectedPrdBlob":expected,"prdFrozen":blob==expected,
            "enforcementMissing":sorted(set(prd_ids)-set(enforcement_ids)),
            "enforcementUnknown":sorted(set(enforcement_ids)-set(prd_ids)),
            "enforcedV1":sum(1 for x in enforcement["rules"].values() if x.get("status")=="enforced-v1"),
            "pendingV1":sum(1 for x in enforcement["rules"].values() if x.get("status")=="pending-v1")}
    print(json.dumps(report,ensure_ascii=False,indent=2))
    if missing or unknown or duplicates or report["enforcementMissing"] or report["enforcementUnknown"] or blob!=expected:
        print("PRD CONTRACT COVERAGE FAILED",file=sys.stderr)
        return 2
    print("PRD CONTRACT COVERAGE PASS")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
