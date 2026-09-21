from backend.fact_merge_contract import merge_confirmed_facts, validate_profile

def rules(es): return {e["ruleId"] for e in es}

def test_merge_preserves_unrelated_existing_facts():
    old={"city":"天津","hobbies":["跑步"],"education":"本科"}
    r=merge_confirmed_facts(old,{"hobbies":["阅读"],"education":"硕士"},confirmed_fields={"hobbies"})
    assert r["profile"]=={"city":"天津","hobbies":["跑步","阅读"],"education":"本科"}
    assert r["conflicts"]==[]

def test_scalar_conflict_is_not_silently_overwritten():
    r=merge_confirmed_facts({"education":"本科"},{"education":"硕士"},confirmed_fields={"education"})
    assert r["profile"]["education"]=="本科"
    assert r["conflicts"][0]["field"]=="education"

def test_ambiguous_goal_and_escape_options_block():
    p={"primaryGoal":"两者都要","contentTone":["专业","温暖","幽默"],"hobbies":["跳过"]}
    es=validate_profile(p)
    assert {"DATA-004","DATA-014","DATA-015"} <= rules(es)
