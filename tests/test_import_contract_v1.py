from backend.import_contract import validate_package, FROZEN_PRD_COMMIT, FROZEN_PRD_BLOB

def base():
    return {
      "contract":{"prdCommit":FROZEN_PRD_COMMIT,"prdBlobSha":FROZEN_PRD_BLOB},
      "agents":[{"agentId":"150000001","primaryGoal":"customer_acquisition"}],
      "reviews":[],
      "skippedReviews":[],
      "stableOutputs":{},
      "writePolicy":{"productionWrite":False,"overwriteProposal":False,"deleteHistoricalProposals":False,"overwriteCurrent":False},
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
