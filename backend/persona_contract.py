"""PRD-linked deterministic persona gates for Import Harness V1.

This module is deliberately side-effect free. It does not generate, persist or
promote outputs. Semantic/evidence rules that cannot be proven deterministically
remain for later evidence-bound gates; they are never silently treated as PASS.
"""
from __future__ import annotations
import re

XHS_FOOTER="本账号所述内容为个人意见，不代表任何官方意见。"
VIDEO_OPINION="本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见"
XHS_BANNED=re.compile(r"保险|金融|理财|贷款|股票|基金|医疗|护理|教育|玄学|友邦|\bAIA\b|微信|手机号|电话|QQ|二维码|https?://|www\.",re.I)
SOURCE_PREFIXES=("客户高频评价","客户都评价我","大家眼中的我","多位客户认为","多人评价","多人反馈","大家常说我","客户认为我","客户觉得我","大家觉得我","身边人说我","朋友都说我","别人都说我")
EMPTY_LICENSE={"","000","待补充","【待补充】","xxx","XXX"}
MECHANICAL_HEADLINE=("是我的标签","是我的专业底色","做一个让人记得住的人")
LOW_VALUE_TIME=re.compile(r"(多年|长期).*(经验|从业|工作)")
UNSUPPORTED_HEADLINE=re.compile(r"(专家|导师|顾问|0人脉|零人脉)")
UNSUPPORTED_HEADLINE=re.compile(r"(专家|导师|顾问|0人脉|零人脉)")
GENERIC_REVIEW_ONLY={"靠谱","专业","真诚","细致","有耐心","暖心","行动派"}
LICENSE_TEXT=re.compile(r"执业证编号[:：]")

def _lines(value):
    if isinstance(value,list): return [str(x).strip() for x in value if str(x).strip()]
    return [x.strip() for x in str(value or "").splitlines() if x.strip()]

def _width(text):
    # PRD uses Chinese-equivalent visual width; deterministic preflight uses
    # CJK/emoji as 1 and ASCII as 0.5. This is a conservative layout gate.
    return sum(0.5 if ord(ch)<128 else 1 for ch in str(text or ""))

def _body_lines(output):
    for key in ("personLines","bioLines","bodyLines"):
        if isinstance(output.get(key),list):
            return _lines(output.get(key))
    merged=[]
    for key in ("whoLines","advantageLines","valueLines"):
        merged.extend(_lines(output.get(key)))
    return merged

def _evidence_claims(output):
    ledger=(output or {}).get("evidenceLedger") or []
    return {_norm_ev(x.get("claim")) for x in ledger if isinstance(x,dict) and x.get("claim")}

def _norm_ev(v):
    return re.sub(r"[\s，。；、|｜]+","",str(v or "")).lower()

def _mapped_claims(output):
    mapping=(output or {}).get("evidenceMap") or {}
    return mapping if isinstance(mapping,dict) else {}

def _err(rule_id,code,detail=""):
    return {"ruleId":rule_id,"code":code,"detail":detail}

def validate_output(output:dict,*,agent_id="",production=False):
    errors=[]
    if not isinstance(output,dict):
        return [_err("ACC-001","output_not_object")]
    headline=str(output.get("headline") or "").strip()
    xhs=_lines(output.get("xiaohongshuBio"))
    video=_lines(output.get("videoDouyinBio"))

    if not headline: errors.append(_err("HEAD-001","missing_headline"))
    if "|" in headline or "｜" in headline: errors.append(_err("HEAD-005","headline_vertical_bar"))
    if agent_id and agent_id in headline: errors.append(_err("HEAD-005","headline_contains_agent_id"))
    if headline and XHS_BANNED.search(headline): errors.append(_err("HEAD-009","headline_xhs_compliance"))
    if any(p in headline for p in MECHANICAL_HEADLINE) or ("从" in headline and "跨界" in headline):
        errors.append(_err("HEAD-006","mechanical_headline"))
    if headline and UNSUPPORTED_HEADLINE.search(headline):
        errors.append(_err("HEAD-004","unsupported_headline_claim",headline))
    if headline and LOW_VALUE_TIME.search(headline):
        errors.append(_err("HEAD-004","vague_duration_in_headline",headline))
    body=_body_lines(output)
    claims=_evidence_claims(output); mapping=_mapped_claims(output)
    # HEAD/BIO evidence mapping is explicit: every rendered semantic line must
    # point to one or more admitted evidence claims. Headline can map to 2–3.
    if headline:
        refs=mapping.get("headline") or []
        if not isinstance(refs,list) or not (1<=len(refs)<=3) or any(_norm_ev(x) not in claims for x in refs):
            errors.append(_err("HEAD-011","headline_evidence_mapping_missing_or_invalid"))
    for i,line in enumerate(body):
        refs=mapping.get(f"body.{i}") or []
        if not isinstance(refs,list) or not refs or any(_norm_ev(x) not in claims for x in refs):
            errors.append(_err("BIO-016","bio_line_evidence_mapping_missing_or_invalid",line))
    if body and len(body)<3 and not output.get("evidenceInsufficient"):
        errors.append(_err("BIO-010","bio_under_three_lines_without_evidence_exception"))
    emojis=[]
    for line in body:
        first=str(line).strip()[:1]
        if first: emojis.append(first)
        if first=="👤": errors.append(_err("BIO-014","deprecated_person_emoji",line))
        if _width(line)>25:
            errors.append(_err("BIO-011","bio_line_over_25_width",line))
    if len(emojis)!=len(set(emojis)):
        errors.append(_err("BIO-014","duplicate_body_emoji"))
    services=output.get("services") or []
    if isinstance(services,str):
        services=[x.strip() for x in re.split(r"[｜|,，、]",services) if x.strip()]
    for service in services if isinstance(services,list) else []:
        if _width(service)>6:
            errors.append(_err("BIO-007","service_over_6_width",str(service)))

    if not xhs or xhs[-1]!=XHS_FOOTER:
        errors.append(_err("COMP-004","xhs_footer_not_exact_last"))
    if headline and (len(xhs)<2 or xhs[-2]!=headline):
        errors.append(_err("HEAD-008","xhs_headline_not_canonical"))
    xhs_body=xhs[:-2] if len(xhs)>=2 and xhs[-1]==XHS_FOOTER and xhs[-2]==headline else [x for x in xhs if x!=XHS_FOOTER and x!=headline]
    if LICENSE_TEXT.search("\n".join(xhs)):
        errors.append(_err("COMP-003","xhs_contains_license_number"))
    if XHS_BANNED.search("\n".join(xhs_body)):
        errors.append(_err("COMP-002","xhs_body_compliance"))
    if _width("\n".join(xhs))>100:
        errors.append(_err("BIO-015","xhs_complete_bio_over_100_width"))
    forbidden_source_lines=[x for x in body+xhs_body if any(p in str(x) for p in SOURCE_PREFIXES)]
    if forbidden_source_lines:
        errors.append(_err("BIO-006","peer_review_source_prefix","；".join(forbidden_source_lines)))
    video_body=video[:max(0,len(video)-4)] if headline and len(video)>=4 and video[-4]==headline else []
    if xhs_body != video_body:
        errors.append(_err("BIO-008","cross_platform_body_drift"))
    if xhs_body != body:
        errors.append(_err("BIO-009","bio_body_structure_drift"))

    if len(video)<3 or video[-3]!=VIDEO_OPINION or not video[-2].startswith("营销服务部：") or not video[-1].startswith("执业证编号："):
        errors.append(_err("COMP-005","video_footer_structure"))
    if _width("\n".join(video))>100:
        errors.append(_err("BIO-015","video_complete_bio_over_100_width"))
    footer_start=len(video)-3 if len(video)>=3 else len(video)
    if headline and (footer_start<1 or video[footer_start-1]!=headline):
        errors.append(_err("HEAD-008","video_headline_not_canonical"))

    dept=video[-2].split("：",1)[1].strip() if len(video)>=2 and video[-2].startswith("营销服务部：") else ""
    license_no=video[-1].split("：",1)[1].strip() if video and video[-1].startswith("执业证编号：") else ""
    if license_no and agent_id and license_no==str(agent_id).strip():
        errors.append(_err("COMP-006","agent_id_used_as_license"))
    if production and (dept in EMPTY_LICENSE or license_no in EMPTY_LICENSE):
        errors.append(_err("COMP-007","production_missing_or_placeholder_credentials"))
    if production and (dept=="000" or license_no=="000"):
        errors.append(_err("COMP-007","production_000_placeholder"))

    return errors

def rule_ids(errors):
    return sorted({e["ruleId"] for e in errors})
