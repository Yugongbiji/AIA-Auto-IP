from backend.evidence_contract import validate_evidence_ledger, rank_assets

def rules(es): return {e["ruleId"] for e in es}

def test_numeric_duration_cannot_be_weakened():
    x=[{"claim":"多年工程经验","sourceText":"7年+工程经验","sourceGrade":"A","sourceField":"form","factKey":"career"}]
    assert "EVID-003" in rules(validate_evidence_ledger(x))

def test_category_cannot_upgrade_to_specific_school():
    x=[{"claim":"复旦大学背景","sourceText":"QS前100背景","sourceGrade":"A","sourceField":"education","factKey":"school"}]
    assert "EVID-009" in rules(validate_evidence_ledger(x))

def test_conflict_requires_human_resolution():
    x=[
      {"claim":"7年工程经验","sourceText":"7年工程经验","sourceGrade":"A","sourceField":"form","factKey":"career_years"},
      {"claim":"10年工程经验","sourceText":"10年工程经验","sourceGrade":"B","sourceField":"selfIntro","factKey":"career_years"}]
    assert "EVID-007" in rules(validate_evidence_ledger(x))

def test_asset_competition_dedupes_and_ranks():
    x=[
      {"claim":"马拉松完赛","sourceGrade":"A","sourceField":"form","factKey":"marathon","assetType":"rare_specific"},
      {"claim":"马拉松完赛","sourceGrade":"C","sourceField":"peer","factKey":"marathon","assetType":"rare_specific"},
      {"claim":"爱读书","sourceGrade":"B","sourceField":"selfIntro","factKey":"reading","assetType":"interest"}]
    ranked=rank_assets(x)
    assert [r["claim"] for r in ranked]==["马拉松完赛","爱读书"]
    assert len(ranked[0]["sources"])==2

def test_under_five_year_current_industry_loses_asset_competition():
    x=[{"claim":"3年当前行业","sourceGrade":"A","sourceField":"form","factKey":"current","assetType":"numeric_experience","isCurrentIndustry":True}]
    assert rank_assets(x,3)[0]["score"]==-1
