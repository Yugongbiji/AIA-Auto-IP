from backend.rule_scope_contract import rules_for_scope, semantic_candidate_rule_ids
from backend.semantic_judge_contract import build_tasks

def test_scopes_are_disjoint_and_only_cover_executor_rules():
    release=set(rules_for_scope("release")); batch=set(rules_for_scope("batch")); candidate=set(rules_for_scope("candidate"))
    assert not (release & batch or release & candidate or batch & candidate)
    assert release and batch and candidate

def test_deterministic_rules_are_not_sent_to_semantic_judge():
    ids=set(semantic_candidate_rule_ids())
    for rid in ["NICK-012","NICK-014","NICK-015","BIO-006","BIO-008","BIO-009","HEAD-002","HEAD-004"]:
        assert rid not in ids

def test_semantic_task_is_rule_scoped_and_fact_bounded():
    c={"confirmedFacts":{"hobby":"滑雪"},"evidenceLedger":[{"claim":"喜欢滑雪"}],
       "assetRanking":[{"claim":"喜欢滑雪","score":20}],"nicknamePrimary":"滑雪娟娟",
       "nicknameCandidates":[],"headline":"真实标题","whoLines":["⛷️ 喜欢滑雪"],
       "xiaohongshuBio":[],"videoDouyinBio":[]}
    tasks=build_tasks(c)
    assert tasks
    for t in tasks:
        assert t["ruleId"] in semantic_candidate_rule_ids()
        assert "不得补充事实" in t["instruction"]
        assert "confirmedFacts" in t["candidate"] and "evidenceLedger" in t["candidate"] and "assetRanking" in t["candidate"]
