import json, subprocess, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
FIXTURE=ROOT/"tests/fixtures/tianjin_import_sanitized_v1.json"

def test_sanitized_tianjin_fixture_has_expected_batch_invariants():
    d=json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert d["counts"]=={
      "roster":69,"supplementalMerged":4,"reviewsTotal":59,"reviewsMatched":58,
      "reviewsSkipped":1,"stableOutputs":50,"blockedOutputs":19,
    }
    assert len(d["agents"])==69
    assert len(d["reviews"])==58
    assert len(d["skippedReviews"])==1
    assert len(d["stableOutputs"])==50
    assert len(d["blockedOutputs"])==19
    roster={x["agentId"] for x in d["agents"]}
    assert d["skippedReviews"][0]["agentId"] not in roster

def test_sanitized_tianjin_fixture_passes_read_only_harness():
    p=subprocess.run([sys.executable,str(ROOT/"tools/aia_import_harness.py"),"--input",str(FIXTURE)],
                     cwd=ROOT,text=True,capture_output=True)
    assert p.returncode==0, p.stdout+"\n"+p.stderr
    report=json.loads(p.stdout.split("IMPORT HARNESS PREFLIGHT PASS")[0])
    assert report["productionWrite"] is False
    assert report["prdContractCoverage"]=="PASS"
    assert report["rosterRows"]==69
    assert report["stableOutputs"]==50
    assert report["invalidStable"]=={}
