from backend.nickname_contract import validate_nickname_output, memory_score

def rules(es): return {e["ruleId"] for e in es}

def row(name,**kw):
    r={"nickname":name,"isBareAnchor":False,"hasDistinctiveModifier":False,
       "hasEvidenceDistinctiveModifier":False,"hasCurrentDistinctiveTrait":False,
       "isRealHighFrequencyAnchor":False,"matureProtectedOriginal":False,"allEnglish":False}
    r.update(kw); r["memoryScore"]=memory_score(r); return r

def test_bare_high_frequency_anchor_cannot_beat_distinctive_candidate():
    bare=row("波姐",isBareAnchor=True,isRealHighFrequencyAnchor=True)
    distinctive=row("行动派波姐",hasDistinctiveModifier=True,hasEvidenceDistinctiveModifier=True,isRealHighFrequencyAnchor=True)
    o={"nicknamePrimary":"波姐","nicknameCandidates":[bare,distinctive]}
    es=validate_nickname_output(o)
    assert {"NICK-012","NICK-015"} <= rules(es)

def test_bare_anchor_can_be_primary_when_no_valid_distinctive_candidate():
    bare=row("波姐",isBareAnchor=True,isRealHighFrequencyAnchor=True)
    o={"nicknamePrimary":"波姐","nicknameCandidates":[bare]}
    assert "NICK-012" not in rules(validate_nickname_output(o))

def test_real_anchor_backup_is_mandatory():
    only=row("行动派波姐",hasDistinctiveModifier=True,hasEvidenceDistinctiveModifier=True)
    assert "NICK-027" in rules(validate_nickname_output({"nicknamePrimary":"行动派波姐","nicknameCandidates":[only]}))

def test_declared_memory_score_must_match_machine_score():
    bare=row("波姐",isBareAnchor=True); bare["memoryScore"]=99
    assert "NICK-014" in rules(validate_nickname_output({"nicknamePrimary":"波姐","nicknameCandidates":[bare]}))
