from backend.candidate_report import build_candidate_report
from backend.persona_contract import XHS_FOOTER, VIDEO_OPINION
from backend.prd_rule_executor import MANIFEST

def good():
    h="🌊 十年工程经历，也是一名长期跑者"
    return {"headline":h,"whoLines":["🏗️ 十年工程经历"],"advantageLines":["🏃 长期跑步"],"valueLines":["📚 持续分享真实经验"],
      "xiaohongshuBio":["🏗️ 十年工程经历","🏃 长期跑步","📚 持续分享真实经验",h,XHS_FOOTER],
      "videoDouyinBio":["🏗️ 十年工程经历","🏃 长期跑步","📚 持续分享真实经验",h,VIDEO_OPINION,"营销服务部：测试部","执业证编号：LICENSE-1"],
      "evidenceLedger":[
       {"claim":"十年工程经历","sourceText":"十年工程经历","sourceGrade":"A","sourceField":"career","factKey":"career","assetType":"numeric_experience"},
       {"claim":"长期跑步","sourceText":"长期跑步","sourceGrade":"B","sourceField":"self","factKey":"running","assetType":"interest"},
       {"claim":"持续分享真实经验","sourceText":"持续分享真实经验","sourceGrade":"B","sourceField":"self","factKey":"sharing","assetType":"interest"}],
      "evidenceMap":{"headline":["十年工程经历","长期跑步"],"body.0":["十年工程经历"],"body.1":["长期跑步"],"body.2":["持续分享真实经验"]}}

def test_candidate_report_is_read_only_and_rule_linked():
    d={"contract":{"prdCommit":"c0255a6467e9deaa5daf1c522ab3cecdb603063d","prdBlobSha":"6cac1ca714ac7fe72ddc1796aed3a1d43e55fdd6"},
       "agents":[{"agentId":"150000001","primaryGoal":"customer_acquisition"}],"reviews":[],"skippedReviews":[],
       "writePolicy":{"productionWrite":False,"overwriteProposal":False,"deleteHistoricalProposals":False,"overwriteCurrent":False,"profileMergeMode":"merge_preserve_existing"},
       "stableOutputs":{"150000001":good()},
       "ruleExecutorResults":{"150000001":[{"ruleId":rid,"status":"PASS","evidence":"synthetic evidence","reason":"synthetic pass"} for rid in MANIFEST["rules"]]}}
    r=build_candidate_report(d)
    assert r["productionWrite"] is False
    assert r["summary"]=={"candidates":1,"ready":1,"keep":0,"blocked":0}
    assert r["candidates"][0]["topAssets"][0]=="十年工程经历"
