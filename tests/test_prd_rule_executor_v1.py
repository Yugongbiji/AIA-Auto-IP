from backend.prd_rule_executor import validate_executor_results, MANIFEST
from backend.semantic_judge_contract import build_tasks

def pass_rows():
    return [{"ruleId":rid,"status":"PASS","evidence":"synthetic contract evidence","reason":"synthetic test pass"} for rid in MANIFEST["rules"]]

def test_missing_any_executor_result_blocks():
    rows=pass_rows()[1:]
    r=validate_executor_results(rows)
    assert r["blocked"] is True
    assert any(e["code"]=="executor_result_missing" for e in r["errors"])

def test_malformed_or_fail_blocks():
    rows=pass_rows(); rows[0]["evidence"]=""
    assert validate_executor_results(rows)["blocked"] is True
    rows=pass_rows(); rows[0]["status"]="FAIL"
    assert validate_executor_results(rows)["blocked"] is True

def test_all_registered_executor_results_can_pass():
    r=validate_executor_results(pass_rows())
    assert r["blocked"] is False
    assert len(r["passed"])==len(MANIFEST["rules"])

def test_semantic_tasks_are_one_rule_at_a_time():
    c={"headline":"测试","evidenceLedger":[]}
    tasks=build_tasks(c,["NICK-001","HEAD-002","BIO-001","CONTENT-001"])
    assert len(tasks)==4
    assert all(t["outputSchema"]["ruleId"]==t["ruleId"] for t in tasks)
