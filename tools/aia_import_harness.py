#!/usr/bin/env python3
"""Read-only AIA batch import preflight. Never writes Production."""
from __future__ import annotations
import argparse, json, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path: sys.path.insert(0,str(ROOT))
from backend.persona_contract import validate_output
from backend.import_contract import validate_package
from backend.candidate_report import build_candidate_report

def ids(items):
    out=[]
    for x in items or []:
        if isinstance(x,dict):
            v=str(x.get("agentId") or x.get("agent_id") or "").strip()
        else: v=""
        if v: out.append(v)
    return out

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--input",required=True)
    args=ap.parse_args()
    coverage=subprocess.run([sys.executable,str(ROOT/"tools/aia_prd_contract_check.py")],cwd=ROOT,text=True,capture_output=True)
    data=json.loads(Path(args.input).read_text(encoding="utf-8"))
    roster=ids(data.get("agents"))
    stable=data.get("stableOutputs") or {}
    skipped=data.get("skippedReviews") or []
    package_errors=validate_package(data)
    invalid={}
    for aid,out in stable.items():
        errs=validate_output(out,agent_id=aid,production=True)
        if errs:
            invalid[aid]=errs
    duplicate_roster=sorted({x for x in roster if roster.count(x)>1})
    skipped_ids=ids(skipped)
    unmatched_created=sorted(set(skipped_ids)&set(roster))
    candidate_report=build_candidate_report(data)
    report={
      "mode":"read-only-preflight",
      "prdContractCoverage":"PASS" if coverage.returncode==0 else "FAIL",
      "productionWrite":False,
      "packageErrors":package_errors,
      "counts":data.get("counts",{}),
      "rosterRows":len(roster),
      "stableOutputs":len(stable),
      "duplicateRoster":duplicate_roster,
      "skippedReviewAgentsPresentInRoster":unmatched_created,
      "invalidStable":invalid,
      "candidateReport":candidate_report,
    }
    print(json.dumps(report,ensure_ascii=False,indent=2))
    if coverage.returncode!=0 or duplicate_roster or unmatched_created or package_errors or invalid or candidate_report['summary']['blocked']:
        print("IMPORT HARNESS BLOCKED",file=sys.stderr); return 2
    print("IMPORT HARNESS PREFLIGHT PASS"); return 0

if __name__=="__main__":
    raise SystemExit(main())
