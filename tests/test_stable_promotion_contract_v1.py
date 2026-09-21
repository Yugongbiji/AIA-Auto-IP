from backend.persona_contract import XHS_FOOTER, VIDEO_OPINION
from backend.stable_promotion_contract import decide_promotion, resolve_current, build_proposal_history

def candidate(headline="🌊 十年工程经历，也是一名长期跑者"):
    return {
      "headline":headline,
      "whoLines":["🏗️ 十年工程经历"],"advantageLines":["🏃 长期跑步"],"valueLines":["📚 持续分享真实经验"],
      "xiaohongshuBio":["🏗️ 十年工程经历","🏃 长期跑步","📚 持续分享真实经验",headline,XHS_FOOTER],
      "videoDouyinBio":["🏗️ 十年工程经历","🏃 长期跑步","📚 持续分享真实经验",headline,VIDEO_OPINION,"营销服务部：测试部","执业证编号：LICENSE-1"],
      "evidenceLedger":[
        {"claim":"十年工程经历","sourceText":"十年工程经历","sourceGrade":"A","sourceField":"previousCareer","factKey":"career","assetType":"numeric_experience"},
        {"claim":"长期跑步","sourceText":"长期跑步","sourceGrade":"B","sourceField":"selfIntro","factKey":"running","assetType":"interest"}],
    }

def test_invalid_candidate_can_never_promote():
    c=candidate(); c["xiaohongshuBio"][-1]="错误声明"
    assert decide_promotion(None,c,agent_id="150000001")["decision"]=="BLOCK"

def test_existing_stable_requires_allowed_reason():
    c=candidate("🌊 新版本")
    assert decide_promotion(candidate(),c,agent_id="150000001",quality={"current":1,"candidate":2})["decision"]=="KEEP"

def test_existing_stable_requires_strict_quality_comparison():
    assert decide_promotion(candidate(),candidate("🌊 新版本"),agent_id="150000001",reason="stronger_asset")["decision"]=="BLOCK"

def test_equal_or_worse_candidate_keeps_current():
    r=decide_promotion(candidate(),candidate("🌊 新版本"),agent_id="150000001",reason="stronger_asset",quality={"current":2,"candidate":2})
    assert r["decision"]=="KEEP"

def test_strictly_better_valid_candidate_only_becomes_eligible_not_written():
    r=decide_promotion(candidate(),candidate("🌊 新版本"),agent_id="150000001",reason="stronger_asset",quality={"current":1,"candidate":2})
    assert r["decision"]=="PROMOTE_ELIGIBLE"


def test_existing_current_is_always_read_without_regeneration():
    old=candidate()
    r=resolve_current(old,candidate("🌊 模型新生成"))
    assert r["source"]=="current_ip_outputs"
    assert r["output"]==old
    assert r["regenerationAllowed"] is False

def test_proposal_history_is_append_only():
    old={"proposalId":"p1","headline":"旧"}
    new={"proposalId":"p2","headline":"新"}
    history=build_proposal_history([old],new)
    assert history==[old,new]
    assert history[0] is old

def test_existing_stable_requires_incremental_update_mode():
    r=decide_promotion(candidate(),candidate("🌊 新版本"),agent_id="150000001",reason="stronger_asset",quality={"current":1,"candidate":2},incremental=False)
    assert r["decision"]=="BLOCK"
    assert "STABLE-008" in r["ruleIds"]
