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


def test_every_prd_rule_has_explicit_enforcement_status():
    contract=json.loads((ROOT/"contracts/aia_ip_persona_contract_v1.json").read_text(encoding="utf-8"))
    enforcement=json.loads((ROOT/"contracts/aia_ip_persona_enforcement_v1.json").read_text(encoding="utf-8"))
    expected={x for s in contract["scopes"].values() for x in s["ids"]}
    assert set(enforcement["rules"])==expected
    assert all(v["status"] in {"enforced-v1","executable-v1"} for v in enforcement["rules"].values())
    assert all(v["owner"] for v in enforcement["rules"].values() if v["status"] in {"enforced-v1","executable-v1"})


def test_all_152_rules_are_executable_and_none_pending():
    enforcement=json.loads((ROOT/"contracts/aia_ip_persona_enforcement_v1.json").read_text(encoding="utf-8"))
    statuses=[v["status"] for v in enforcement["rules"].values()]
    assert len(statuses)==152
    assert all(x in {"enforced-v1","executable-v1"} for x in statuses)
    assert "pending-v1" not in statuses
