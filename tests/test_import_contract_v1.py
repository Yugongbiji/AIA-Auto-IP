from backend.import_contract import validate_package, FROZEN_PRD_COMMIT, FROZEN_PRD_BLOB

def base():
    return {
      "contract":{"prdCommit":FROZEN_PRD_COMMIT,"prdBlobSha":FROZEN_PRD_BLOB},
      "agents":[{"agentId":"150000001","primaryGoal":"customer_acquisition"}],
      "reviews":[],
      "skippedReviews":[],
      "stableOutputs":{},
      "writePolicy":{"productionWrite":False,"overwriteProposal":False,"deleteHistoricalProposals":False,"overwriteCurrent":False,"profileMergeMode":"merge_preserve_existing"},
    }

def rules(errors): return {e["ruleId"] for e in errors}

def test_frozen_prd_provenance_required():
    d=base(); d["contract"]["prdCommit"]="wrong"
    assert "GOV-001" in rules(validate_package(d))

def test_agent_id_must_be_nine_digits():
    d=base(); d["agents"][0]["agentId"]="123"
    assert "DATA-012" in rules(validate_package(d))

def test_primary_goal_must_be_normalized():
    d=base(); d["agents"][0]["primaryGoal"]="两者都要"
    assert "DATA-004" in rules(validate_package(d))

def test_unmatched_review_cannot_enter_matched_reviews():
    d=base(); d["reviews"]=[{"agentId":"150000002","review":"测试"}]
    assert "DATA-020" in rules(validate_package(d))

def test_peer_review_cannot_masquerade_as_first_party_facts():
    d=base(); d["agents"][0]["facts"]={"peerReviewSummary":"靠谱"}
    assert "DATA-005" in rules(validate_package(d))

def test_social_media_metrics_cannot_be_persona_assets():
    d=base(); d["stableOutputs"]["150000001"]={"headline":"粉丝10万"}
    assert "DATA-003" in rules(validate_package(d))

def test_internal_jargon_cannot_be_persona_assets():
    d=base(); d["stableOutputs"]["150000001"]={"headline":"A1团队负责人"}
    assert "EVID-006" in rules(validate_package(d))

def test_preflight_cannot_request_stable_or_history_overwrite():
    d=base(); d["writePolicy"]["overwriteCurrent"]=True
    assert "STABLE-005" in rules(validate_package(d))
    d=base(); d["writePolicy"]["overwriteProposal"]=True
    assert "STABLE-003" in rules(validate_package(d))


def test_profile_merge_mode_must_preserve_existing_facts():
    d=base(); d["writePolicy"]["profileMergeMode"]="replace"
    assert "DATA-011" in rules(validate_package(d))

def test_saved_profile_cannot_store_generated_copy():
    d=base(); d["savedProfiles"]=[{"agentId":"150000001","headline":"不应进入事实表"}]
    assert "STABLE-004" in rules(validate_package(d))

def test_stable_candidate_requires_traceable_abc_evidence_ledger():
    d=base(); d["stableOutputs"]["150000001"]={"headline":"测试"}
    assert "EVID-001" in rules(validate_package(d))
    d["stableOutputs"]["150000001"]["evidenceLedger"]=[{"claim":"推断","sourceGrade":"D","sourceField":"ai"}]
    assert "EVID-001" in rules(validate_package(d))

def test_existing_current_output_cannot_be_changed_by_import_package():
    d=base()
    old={"headline":"旧稳定稿","evidenceLedger":[{"claim":"事实","sourceGrade":"A","sourceField":"profile"}]}
    new={"headline":"新候选","evidenceLedger":[{"claim":"事实","sourceGrade":"A","sourceField":"profile"}]}
    d["existingCurrentOutputs"]={"150000001":old}; d["stableOutputs"]={"150000001":new}
    assert "STABLE-005" in rules(validate_package(d))


def test_peer_reviews_preserve_one_to_many_raw_rows():
    d=base(); d["reviews"]=[{"agentId":"150000001","review":"靠谱"},{"agentId":"150000001","review":"靠谱"}]
    assert "DATA-019" in rules(validate_package(d))
