#!/usr/bin/env python3
"""Read-only AIA batch import preflight. Never writes Production."""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path
from backend.stable_ip import validate_output

ERROR_RULES={
 "missing_person_content":["BIO-001","BIO-010"],
 "missing_headline":["HEAD-001"],
 "headline_vertical_bar":["HEAD-005"],
 "mechanical_value":["BIO-001","BIO-002"],
 "isolated_career_value":["BIO-001","BIO-002"],
 "xhs_compliance":["COMP-002","HEAD-009"],
 "xhs_headline_drift":["HEAD-008","BIO-009"],
 "video_headline_drift":["HEAD-008","BIO-009"],
 "xhs_footer":["COMP-004"],
 "video_footer":["COMP-005"],
}

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
    data=json.loads(Path(args.input).read_text(encoding="utf-8"))
    roster=ids(data.get("agents"))
    stable=data.get("stableOutputs") or {}
    skipped=data.get("skippedReviews") or []
    invalid={}
    for aid,out in stable.items():
        errs=validate_output(out)
        if errs:
            invalid[aid]=[{"error":e,"ruleIds":ERROR_RULES.get(e,["ACC-001"])} for e in errs]
    duplicate_roster=sorted({x for x in roster if roster.count(x)>1})
    skipped_ids=ids(skipped)
    unmatched_created=sorted(set(skipped_ids)&set(roster))
    report={
      "mode":"read-only-preflight",
      "productionWrite":False,
      "counts":data.get("counts",{}),
      "rosterRows":len(roster),
      "stableOutputs":len(stable),
      "duplicateRoster":duplicate_roster,
      "skippedReviewAgentsPresentInRoster":unmatched_created,
      "invalidStable":invalid,
    }
    print(json.dumps(report,ensure_ascii=False,indent=2))
    if duplicate_roster or unmatched_created or invalid:
        print("IMPORT HARNESS BLOCKED",file=sys.stderr); return 2
    print("IMPORT HARNESS PREFLIGHT PASS"); return 0

if __name__=="__main__":
    raise SystemExit(main())
