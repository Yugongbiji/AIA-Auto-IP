from pathlib import Path
import json, re, hashlib

ROOT=Path(__file__).resolve().parents[1]

def test_frozen_prd_has_exact_machine_contract_coverage():
    contract=json.loads((ROOT/"contracts/aia_ip_persona_contract_v1.json").read_text(encoding="utf-8"))
    raw=(ROOT/contract["prd"]["path"]).read_bytes()
    ids=re.findall(r"\*\*([A-Z]+-\d{3})\*\*",raw.decode("utf-8"))
    mapped=[x for s in contract["scopes"].values() for x in s["ids"]]
    assert len(ids)==152
    assert len(mapped)==152
    assert set(ids)==set(mapped)
    assert len(mapped)==len(set(mapped))
    blob=hashlib.sha1(f"blob {len(raw)}\0".encode()+raw).hexdigest()
    assert blob==contract["prd"]["gitBlobSha"]

def test_import_harness_is_non_production_by_default():
    contract=json.loads((ROOT/"contracts/aia_ip_persona_contract_v1.json").read_text(encoding="utf-8"))
    assert contract["policy"]["productionMutation"] is False
    assert contract["importHarnessV1"]["productionWrite"]=="disabled"
    assert contract["importHarnessV1"]["releaseBehavior"]=="fail_closed"
