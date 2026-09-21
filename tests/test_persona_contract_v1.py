from backend.persona_contract import XHS_FOOTER, VIDEO_OPINION, validate_output

def valid_output():
    headline="🌊 十年工程经历，也是一名长期跑者"
    return {
      "headline":headline,
      "whoLines":["🏗️ 十年工程经历"],
      "advantageLines":["🏃 长期跑步"],
      "valueLines":["📚 持续分享真实经验"],
      "xiaohongshuBio":["🏗️ 十年工程经历","🏃 长期跑步","📚 持续分享真实经验",headline,XHS_FOOTER],
      "videoDouyinBio":["🏗️ 十年工程经历","🏃 长期跑步","📚 持续分享真实经验",headline,VIDEO_OPINION,"营销服务部：天津第一营销服务部","执业证编号：LICENSE-123"],
    }

def codes(errors): return {x["code"] for x in errors}
def rules(errors): return {x["ruleId"] for x in errors}

def test_valid_canonical_group_passes_deterministic_gate():
    assert validate_output(valid_output(),agent_id="150000001",production=True)==[]

def test_xhs_sensitive_headline_blocks_before_stable():
    o=valid_output(); o["headline"]="金融从业十年，也是一名长期跑者"; o["xiaohongshuBio"][-2]=o["headline"]; o["videoDouyinBio"][-4]=o["headline"]
    e=validate_output(o,agent_id="150000001")
    assert "HEAD-009" in rules(e)

def test_headline_drift_is_rule_linked():
    o=valid_output(); o["xiaohongshuBio"][-2]="另一句话"
    e=validate_output(o,agent_id="150000001")
    assert "HEAD-008" in rules(e)

def test_agent_id_can_never_be_license_number():
    o=valid_output(); o["videoDouyinBio"][-1]="执业证编号：150000001"
    e=validate_output(o,agent_id="150000001",production=True)
    assert "COMP-006" in rules(e)

def test_production_placeholder_credentials_block():
    o=valid_output(); o["videoDouyinBio"][-2]="营销服务部：【待补充】"; o["videoDouyinBio"][-1]="执业证编号：000"
    e=validate_output(o,agent_id="150000001",production=True)
    assert "COMP-007" in rules(e)
    assert "production_missing_or_placeholder_credentials" in codes(e)

def test_peer_review_source_prefix_not_rendered():
    o=valid_output(); o["xiaohongshuBio"].insert(0,"多人评价：靠谱｜细致")
    e=validate_output(o,agent_id="150000001")
    assert "BIO-006" in rules(e)


def test_xhs_must_not_contain_license_number():
    o=valid_output(); o["xiaohongshuBio"].insert(0,"执业证编号：ABC123")
    e=validate_output(o,agent_id="150000001")
    assert "COMP-003" in rules(e)

def test_mechanical_headline_is_blocked():
    o=valid_output(); o["headline"]="靠谱是我的标签"; o["xiaohongshuBio"][-2]=o["headline"]; o["videoDouyinBio"][-4]=o["headline"]
    e=validate_output(o,agent_id="150000001")
    assert "HEAD-006" in rules(e)

def test_bio_under_three_lines_requires_explicit_evidence_exception():
    o=valid_output(); o["whoLines"]=["🏗️ 十年工程经历"]; o["advantageLines"]=[]; o["valueLines"]=[]
    e=validate_output(o,agent_id="150000001")
    assert "BIO-010" in rules(e)
    o["evidenceInsufficient"]=True
    assert "BIO-010" not in rules(validate_output(o,agent_id="150000001"))

def test_bio_line_absolute_width_gate():
    o=valid_output(); o["whoLines"]=["🏗️"+"真实经历"*7]
    assert "BIO-011" in rules(validate_output(o,agent_id="150000001"))

def test_service_item_width_gate():
    o=valid_output(); o["services"]=["家庭长期综合规划服务"]
    assert "BIO-007" in rules(validate_output(o,agent_id="150000001"))
