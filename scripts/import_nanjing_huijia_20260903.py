#!/usr/bin/env python3
"""Safe one-time importer for Nanjing Huijia 2026-09-03 batch.

Inputs stay outside Git. Dry-run is default. --commit creates a SQLite backup first.
Existing agents are never overwritten by this batch; existing current_ip_outputs are a hard conflict.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import server
from backend.stable_ip import ensure_stable_schema, quality_score, validate_output

XHS_FOOTER = "本账号所述内容为个人意见，不代表任何官方意见。"
VIDEO_OPINION = "本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见"
SOURCE = "nanjing_huijia_human_approved_20260903"


def clean(v):
    return str(v or "").strip()


def split_lines(v):
    return [x.strip() for x in clean(v).splitlines() if x.strip()]


def load_roster(path: Path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb["最终名单"] if "最终名单" in wb.sheetnames else wb.worksheets[0]
    rows = ws.iter_rows(values_only=True)
    for row in rows:
        if clean(row[0]) == "序号":
            break
    out = {}
    for row in rows:
        aid, group, name = clean(row[1]), clean(row[2]), clean(row[3])
        if aid and name:
            out[aid] = {"agentId": aid, "name": name, "directGroup": group}
    return out


def load_basic(path: Path, roster: dict):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = ws.iter_rows(values_only=True)
    headers = [clean(x) for x in next(rows)]
    keys = [server.header_key(h) for h in headers]
    out = {}
    for row in rows:
        rec = {k: clean(v) for k, v in zip(keys, row) if k and clean(v)}
        aid = rec.get("agentId", "")
        if aid in roster and rec.get("name") == roster[aid]["name"]:
            rec["directGroup"] = roster[aid]["directGroup"]
            out[aid] = rec
    return out


def load_reviews(path: Path, roster: dict):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = ws.iter_rows(values_only=True)
    headers = [clean(x) for x in next(rows)]
    idx = {h: i for i, h in enumerate(headers)}
    required = [
        "1. 生活中你怎么称呼TA", "2.你和TA的关系？", "3. 如果只能选3个词形容TA，你会选？",
        "4. 遇到什么事情，你比较愿意找TA聊聊？", "5. 如果把TA介绍给朋友，你觉得TA更像哪种人？",
        "6. 如果只能用一句话把TA介绍给一个不认识的人，你会怎么说？", "7.请输入分享给你问卷的营销员信息",
    ]
    missing = [h for h in required if h not in idx]
    if missing:
        raise RuntimeError("客户反馈表缺列：" + "；".join(missing))
    grouped = defaultdict(list)
    for row in rows:
        aid = clean(row[idx[required[6]]])
        if aid not in roster:
            continue
        grouped[aid].append({
            "nickname": clean(row[idx[required[0]]]), "relationship": clean(row[idx[required[1]]]),
            "traits": clean(row[idx[required[2]]]), "topics": clean(row[idx[required[3]]]),
            "roles": clean(row[idx[required[4]]]), "intro": clean(row[idx[required[5]]]),
        })
    return grouped


def split_multi(v):
    text = clean(v).replace("；", ";").replace("、", ";").replace("，", ";").replace(",", ";")
    return [x.strip() for x in text.split(";") if x.strip() and x.strip() != "其他"]


def review_summary(rows):
    nick, rel, traits, topics, roles = Counter(), Counter(), Counter(), Counter(), Counter()
    quotes = []
    for r in rows:
        if r["nickname"]: nick[r["nickname"]] += 1
        if r["relationship"]: rel[r["relationship"]] += 1
        traits.update(split_multi(r["traits"])); topics.update(split_multi(r["topics"])); roles.update(split_multi(r["roles"]))
        if r["intro"] and r["intro"] not in quotes: quotes.append(r["intro"])
    fmt = lambda c: [{"label": k, "count": v} for k, v in c.most_common()]
    return {"source": "身边人评价问卷", "reviewCount": len(rows), "topNicknames": fmt(nick), "relationships": fmt(rel), "topTraits": fmt(traits), "topTopics": fmt(topics), "topRoles": fmt(roles), "representativeQuotes": quotes}


def load_stable(path: Path, roster: dict):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb["稳定输出"]
    rows = ws.iter_rows(values_only=True)
    headers = [clean(x) for x in next(rows)]
    idx = {h: i for i, h in enumerate(headers)}
    need = ["工号", "姓名", "生成状态", "推荐昵称", "一句话IP", "小红书推荐简介（含合规声明）", "视频号/抖音推荐简介（含合规声明）"]
    missing = [h for h in need if h not in idx]
    if missing: raise RuntimeError("稳定稿缺列：" + "；".join(missing))
    out = {}
    for row in rows:
        aid = clean(row[idx["工号"]]); status = clean(row[idx["生成状态"]])
        if aid not in roster or not status.startswith("已生成"):
            continue
        if clean(row[idx["姓名"]]) != roster[aid]["name"]:
            raise RuntimeError(f"稳定稿姓名不匹配：{aid}")
        xhs = split_lines(row[idx["小红书推荐简介（含合规声明）"]])
        video = split_lines(row[idx["视频号/抖音推荐简介（含合规声明）"]])
        headline = clean(row[idx["一句话IP"]])
        body = [x for x in xhs if x != headline and x != XHS_FOOTER]
        # The approved workbook is the display truth. Dimensions below are metadata only;
        # do not invent missing dimensions for feedback-only people.
        advantages = [x for x in body if x.startswith(("✨", "🌟", "🏆", "⭐"))]
        who = [x for x in body if x not in advantages]
        if not who and body:
            advantages = body
        out[aid] = {
            "nickname": clean(row[idx["推荐昵称"]]),
            "whoLines": who,
            "advantageLines": advantages,
            "valueLines": [],
            "headline": headline,
            "xiaohongshuBio": xhs,
            "videoDouyinBio": video,
        }
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--roster", type=Path, required=True)
    ap.add_argument("--basic", type=Path, required=True)
    ap.add_argument("--reviews", type=Path, required=True)
    ap.add_argument("--stable", type=Path, required=True)
    ap.add_argument("--commit", action="store_true")
    args = ap.parse_args()

    server.load_local_env(); server.initialize_database()
    if server.database_engine() != "sqlite":
        raise SystemExit("本批次脚本只允许在当前 SQLite Production/Preview 数据库执行。")

    roster = load_roster(args.roster); basic = load_basic(args.basic, roster); reviews = load_reviews(args.reviews, roster); stable = load_stable(args.stable, roster)
    invalid = {aid: validate_output(v) for aid, v in stable.items() if validate_output(v)}
    with server.database() as conn:
        ensure_stable_schema(conn)
        existing_agents = {r["agent_id"] for r in conn.execute("SELECT agent_id FROM agents").fetchall()}
        stable_conflicts = {r["agent_id"] for r in conn.execute("SELECT agent_id FROM current_ip_outputs").fetchall()} & set(roster)
        before = {t: conn.execute(f"SELECT COUNT(*) n FROM {t}").fetchone()["n"] for t in ("agents","saved_profiles","peer_reviews","proposals","current_ip_outputs")}

    summary = {
        "mode": "commit" if args.commit else "dry-run", "roster": len(roster), "basic": len(basic), "reviewAgents": len(reviews),
        "reviewRows": sum(map(len, reviews.values())), "stable": len(stable), "newAgents": len(set(roster)-existing_agents),
        "existingRosterAgents": sorted(set(roster)&existing_agents), "stableConflicts": sorted(stable_conflicts), "invalidStable": invalid, "before": before,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if len(roster) != 57 or len(stable) != 41 or stable_conflicts or invalid:
        raise SystemExit("DRY-RUN 门禁未通过，禁止写库。")
    if not args.commit:
        print("DRY-RUN 通过；加 --commit 才会写库。")
        return

    ts = datetime.now(timezone.utc).isoformat()
    backup = server.DB_PATH.with_name(f"persona.sqlite3.bak-nanjing-{datetime.now().strftime('%Y%m%d-%H%M%S')}")
    shutil.copy2(server.DB_PATH, backup)
    try:
        with server.database() as conn:
            # Add all 57 final participants so tomorrow name+agent-id lookup works.
            for aid, item in roster.items():
                if conn.execute("SELECT 1 FROM agents WHERE agent_id=?", (aid,)).fetchone():
                    continue
                survey = basic.get(aid) or {"name": item["name"], "agentId": aid, "directGroup": item["directGroup"]}
                conn.execute("INSERT INTO agents(agent_id,name,survey_json,imported_at) VALUES (?,?,?,?)", (aid,item["name"],json.dumps(survey,ensure_ascii=False),ts))

            # Raw customer feedback is idempotent for this new batch: only insert when none exists.
            for aid, rows in reviews.items():
                if conn.execute("SELECT COUNT(*) n FROM peer_reviews WHERE agent_id=?", (aid,)).fetchone()["n"]:
                    raise RuntimeError(f"{aid} 已存在 peer_reviews，停止以避免覆盖")
                for r in rows:
                    conn.execute("INSERT INTO peer_reviews(agent_id,reviewer_nickname,relationship,traits,topics,roles,intro,imported_at) VALUES (?,?,?,?,?,?,?,?)", (aid,r["nickname"],r["relationship"],r["traits"],r["topics"],r["roles"],r["intro"],ts))

            # saved_profiles stores only factual additions / review aggregate; never replaces an existing profile.
            for aid in set(basic) | set(reviews):
                if conn.execute("SELECT 1 FROM saved_profiles WHERE agent_id=?", (aid,)).fetchone():
                    raise RuntimeError(f"{aid} 已存在 saved_profiles，停止以避免覆盖")
                profile = dict(basic.get(aid) or {})
                if aid in reviews:
                    profile["peerReviewSummary"] = review_summary(reviews[aid])
                conn.execute("INSERT INTO saved_profiles(agent_id,profile_json,updated_at) VALUES (?,?,?)", (aid,json.dumps(profile,ensure_ascii=False),ts))

            # Exact human-approved workbook text becomes stable output; never overwrite an existing stable row.
            for aid, output in stable.items():
                if conn.execute("SELECT 1 FROM current_ip_outputs WHERE agent_id=?", (aid,)).fetchone():
                    raise RuntimeError(f"{aid} 已存在稳定稿，停止以避免覆盖")
                version = conn.execute("SELECT COALESCE(MAX(version),0)+1 n FROM proposals WHERE agent_id=?", (aid,)).fetchone()["n"]
                score = quality_score(output)
                payload = dict(output); payload["_stableMeta"] = {"source": SOURCE, "qualityScore": score, "approved": True}
                conn.execute("INSERT INTO proposals(agent_id,version,proposal_json,model,created_at) VALUES (?,?,?,?,?)", (aid,version,json.dumps(payload,ensure_ascii=False),"human-approved",ts))
                conn.execute("INSERT INTO current_ip_outputs(agent_id,proposal_version,output_json,quality_score,source,approved_at,updated_at) VALUES (?,?,?,?,?,?,?)", (aid,version,json.dumps(output,ensure_ascii=False),score,SOURCE,ts,ts))

        with server.database() as conn:
            after = {t: conn.execute(f"SELECT COUNT(*) n FROM {t}").fetchone()["n"] for t in ("agents","saved_profiles","peer_reviews","proposals","current_ip_outputs")}
            batch_stable = conn.execute("SELECT COUNT(*) n FROM current_ip_outputs WHERE source=?", (SOURCE,)).fetchone()["n"]
        print(json.dumps({"committed": True, "backup": str(backup), "after": after, "batchStable": batch_stable}, ensure_ascii=False, indent=2))
        if batch_stable != 41:
            raise RuntimeError("写库后南京稳定稿数量不是41")
    except Exception:
        shutil.copy2(backup, server.DB_PATH)
        print(f"IMPORT FAILED; database restored from {backup}", file=sys.stderr)
        raise


if __name__ == "__main__":
    main()
