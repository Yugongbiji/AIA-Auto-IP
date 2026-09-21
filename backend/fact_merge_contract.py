"""Fact merge contract for batch imports. Pure, deterministic, no DB writes."""
from __future__ import annotations
import copy

FACT_FIELDS=("name","city","primaryGoal","targetAudience","targetAge","currentIndustryYears","advantages","honors",
"education","schoolTier","studyAbroad","contentTone","previousCareer","familyIdentity","hobbies","services","marketingDepartment")
MULTI={"advantages","honors","contentTone","previousCareer","familyIdentity","hobbies","services"}
FORBIDDEN_ESCAPE={"其他","不希望填写","跳过","暂不填写"}

def _clean(v):
    if isinstance(v,str): return v.strip()
    if isinstance(v,list): return [x for x in (_clean(x) for x in v) if x not in ("",None)]
    return v

def merge_confirmed_facts(existing,new,*,confirmed_fields=None):
    """DATA-010/011/017: only confirmed missing/new facts merge; unrelated facts survive."""
    out=copy.deepcopy(existing or {}); confirmed=set(confirmed_fields or [])
    changes=[]; conflicts=[]
    for key in FACT_FIELDS:
        if key not in (new or {}) or key not in confirmed: continue
        incoming=_clean(new[key])
        if incoming in ("",None,[]): continue
        old=_clean(out.get(key))
        if key in MULTI:
            old_list=old if isinstance(old,list) else ([old] if old not in ("",None) else [])
            new_list=incoming if isinstance(incoming,list) else [incoming]
            merged=old_list+[x for x in new_list if x not in old_list]
            if merged!=old_list: out[key]=merged; changes.append(key)
        elif old in ("",None):
            out[key]=incoming; changes.append(key)
        elif old!=incoming:
            conflicts.append({"field":key,"existing":old,"incoming":incoming})
    return {"profile":out,"changes":changes,"conflicts":conflicts}

def validate_profile(profile):
    errors=[]
    goal=(profile or {}).get("primaryGoal")
    if goal not in {"customer_acquisition","recruitment"}:
        errors.append({"ruleId":"DATA-004","code":"primary_goal_missing_or_ambiguous"})
    tone=(profile or {}).get("contentTone") or []
    if isinstance(tone,str): tone=[tone]
    if len(tone)>2: errors.append({"ruleId":"DATA-014","code":"content_tone_over_two"})
    for field in MULTI:
        vals=(profile or {}).get(field) or []
        if isinstance(vals,str): vals=[vals]
        if any(str(v).strip() in FORBIDDEN_ESCAPE for v in vals):
            errors.append({"ruleId":"DATA-015","code":"escape_option_persisted","detail":field})
    return errors
