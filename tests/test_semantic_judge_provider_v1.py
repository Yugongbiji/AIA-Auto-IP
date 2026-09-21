from backend.semantic_judge_provider import judge_tasks

def test_missing_provider_key_fails_closed(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_API_KEY",raising=False)
    task={"ruleId":"NICK-001","rule":"自然","instruction":"只判断本条","candidate":{}}
    r=judge_tasks([task])
    assert r[0]["status"]=="FAIL"
    assert r[0]["evidence"]=="judge_unavailable"
    assert "missing" in r[0]["reason"]
