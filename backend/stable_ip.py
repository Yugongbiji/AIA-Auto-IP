"""Stable approved IP baseline and incremental-promotion helpers.

This module deliberately stores approved outputs separately from saved_profiles:
- saved_profiles = factual person data
- proposals = immutable output history
- current_ip_outputs = one promoted stable version per agent
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone

XHS_BANNED = re.compile(r"保险|金融|理财|贷款|股票|基金|医疗|护理|教育|玄学|友邦|\bAIA\b|微信|手机号|电话|QQ|二维码|私信|稳赚|无风险|财富自由", re.I)
MECHANICAL_VALUE = ("保险保障", "风险保障", "保险认知", "生活方式保险内容")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_stable_schema(conn) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS current_ip_outputs (
            agent_id TEXT PRIMARY KEY,
            proposal_version INTEGER NOT NULL,
            output_json TEXT NOT NULL,
            quality_score INTEGER NOT NULL,
            source TEXT NOT NULL,
            approved_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(agent_id) REFERENCES agents(agent_id)
        )
        """
    )


def _lines(value) -> list[str]:
    if isinstance(value, list):
        return [str(x).strip() for x in value if str(x).strip()]
    return [x.strip() for x in str(value or "").splitlines() if x.strip()]


def semantic_key(text: str) -> str:
    value = re.sub(r"[\s｜|、，,；;：:。.!！?？（）()]+", "", str(text or "").lower())
    value = value.replace("工作经验", "经历").replace("从业经验", "经历").replace("从业经历", "经历")
    value = value.replace("长期", "").replace("多年", "")
    return value


def dedupe_incremental_facts(existing: list[str], incoming: list[str]) -> dict:
    kept = list(existing or [])
    keys = {semantic_key(x): x for x in kept if semantic_key(x)}
    added, duplicates = [], []
    for fact in incoming or []:
        fact = str(fact or "").strip()
        key = semantic_key(fact)
        if not fact or not key:
            continue
        if key in keys:
            duplicates.append({"incoming": fact, "kept": keys[key]})
            continue
        keys[key] = fact
        kept.append(fact)
        added.append(fact)
    return {"facts": kept, "added": added, "duplicates": duplicates}


def validate_output(output: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(output, dict):
        return ["output_not_object"]
    who = _lines(output.get("whoLines"))
    adv = _lines(output.get("advantageLines"))
    value = _lines(output.get("valueLines"))
    headline = str(output.get("headline") or "").strip()
    xhs = "\n".join(_lines(output.get("xiaohongshuBio")))
    video = "\n".join(_lines(output.get("videoDouyinBio")))
    # Highest 2026-09-03 rule: when truth only supports one or two person lines,
    # preserve the sparse approved bio instead of fabricating missing dimensions.
    if not (who or adv or value): errors.append("missing_person_content")
    if not headline: errors.append("missing_headline")
    if "｜" in headline or "|" in headline: errors.append("headline_vertical_bar")
    if any(term in "\n".join(value) for term in MECHANICAL_VALUE): errors.append("mechanical_value")
    if any(x.strip("💡 ✨🎯🧭") == "职业" for x in value): errors.append("isolated_career_value")
    if XHS_BANNED.search(xhs): errors.append("xhs_compliance")
    if headline and headline not in xhs: errors.append("xhs_headline_drift")
    if headline and headline not in video: errors.append("video_headline_drift")
    if "本账号所述内容为个人意见，不代表任何官方意见。" not in xhs:
        errors.append("xhs_footer")
    video_footer = [
        "本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见",
        "营销服务部：",
        "执业证编号：",
    ]
    for item in video_footer:
        if item not in video: errors.append("video_footer")
    return list(dict.fromkeys(errors))


def quality_score(output: dict) -> int:
    errors = validate_output(output)
    if errors:
        return 0
    who = _lines(output.get("whoLines"))
    adv = _lines(output.get("advantageLines"))
    value = _lines(output.get("valueLines"))
    score = 70
    score += min(8, len(who) * 2)
    score += min(8, len(adv) * 2)
    score += min(8, len(value) * 2)
    score += 3 if any(re.search(r"\d", x) for x in who + adv) else 0
    score += 3 if len({semantic_key(x) for x in who + adv + value}) == len(who + adv + value) else 0
    return min(100, score)


def current_output(conn, agent_id: str):
    ensure_stable_schema(conn)
    row = conn.execute(
        "SELECT proposal_version, output_json, quality_score, source, approved_at, updated_at FROM current_ip_outputs WHERE agent_id = ?",
        (agent_id,),
    ).fetchone()
    if not row:
        return None
    return {
        "proposalVersion": row["proposal_version"],
        "output": json.loads(row["output_json"]),
        "qualityScore": row["quality_score"],
        "source": row["source"],
        "approvedAt": row["approved_at"],
        "updatedAt": row["updated_at"],
    }


def promote_output(conn, agent_id: str, output: dict, source: str, *, approved: bool = False) -> dict:
    errors = validate_output(output)
    if errors:
        return {"promoted": False, "errors": errors, "qualityScore": 0}
    score = quality_score(output)
    current = current_output(conn, agent_id)
    if current and not approved and score <= int(current["qualityScore"]):
        return {"promoted": False, "errors": ["not_better_than_current"], "qualityScore": score, "currentScore": current["qualityScore"]}
    version_row = conn.execute(
        "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM proposals WHERE agent_id = ?", (agent_id,)
    ).fetchone()
    version = version_row["next_version"] if isinstance(version_row, dict) else version_row[0]
    ts = now_iso()
    payload = dict(output)
    payload["_stableMeta"] = {"source": source, "qualityScore": score, "approved": bool(approved)}
    conn.execute(
        "INSERT INTO proposals(agent_id, version, proposal_json, model, created_at) VALUES (?, ?, ?, ?, ?)",
        (agent_id, version, json.dumps(payload, ensure_ascii=False), "human-approved" if approved else "stable-quality-gate", ts),
    )
    conn.execute(
        """
        INSERT INTO current_ip_outputs(agent_id, proposal_version, output_json, quality_score, source, approved_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(agent_id) DO UPDATE SET
          proposal_version=excluded.proposal_version,
          output_json=excluded.output_json,
          quality_score=excluded.quality_score,
          source=excluded.source,
          approved_at=excluded.approved_at,
          updated_at=excluded.updated_at
        """,
        (agent_id, version, json.dumps(output, ensure_ascii=False), score, source, ts, ts),
    )
    return {"promoted": True, "proposalVersion": version, "qualityScore": score, "previousVersion": current["proposalVersion"] if current else None}
