#!/usr/bin/env python3
"""AIA Auto IP 脚本库 Excel 导入器 V1。

默认只做 dry-run；显式写入时统一走应用数据层。
Preview 可直接写 SQLite；正式 PostgreSQL 必须额外显式确认。
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import server
import script_library_store as store

SPEECH_RATE = 260


def clean_text(value):
    if value is None:
        return ""
    return str(value).replace("\r\n", "\n").replace("\r", "\n").strip()


def clean_tag(value):
    return re.sub(r"\s+", "", clean_text(value))


def parse_titles(raw):
    text = clean_text(raw)
    if not text:
        return ["", "", ""]
    pattern = re.compile(r"(?:^|\s|\n)([123])\s*[、\.．:：]\s*")
    matches = list(pattern.finditer(text))
    titles = []
    if matches:
        for i, match in enumerate(matches[:3]):
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            title = text[match.end():end].strip(" \n\t;；")
            if title:
                titles.append(title)
    else:
        titles = [x.strip() for x in text.split("\n") if x.strip()]
    if not titles:
        titles = [text]
    return (titles + ["", "", ""])[:3]


def count_spoken_chars(body):
    return len(re.findall(r"[\u4e00-\u9fffA-Za-z0-9]", body))


def content_hash(body):
    normalized = re.sub(r"\s+", "", body)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def normalize_date(value):
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return clean_text(value) or None


def load_rows(path: Path):
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    headers = [clean_text(c.value) for c in next(ws.iter_rows())]
    index = {name: i for i, name in enumerate(headers)}
    required = ["一级标签", "二级标签", "标题", "正文"]
    missing = [x for x in required if x not in index]
    if missing:
        raise ValueError(f"缺少必要列: {', '.join(missing)}")

    result = []
    for row_no, row in enumerate(ws.iter_rows(), start=2):
        vals = [c.value for c in row]
        body = clean_text(vals[index["正文"]])
        if not body:
            continue
        titles = parse_titles(vals[index["标题"]])
        wc = count_spoken_chars(body)
        result.append({
            "source_row": row_no,
            "batch": clean_text(vals[index["批次"]]) if "批次" in index else "",
            "level1_tag": clean_tag(vals[index["一级标签"]]),
            "level2_tag": clean_tag(vals[index["二级标签"]]),
            "title_1": titles[0], "title_2": titles[1] or None, "title_3": titles[2] or None,
            "body": body,
            "word_count": wc,
            "estimated_minutes": round(wc / SPEECH_RATE, 1),
            "is_hot": clean_tag(vals[index["一级标签"]]) == "热点",
            "reviewed_at": normalize_date(vals[index["过审时间"]]) if "过审时间" in index else None,
            "status": "active",
            "content_hash": content_hash(body),
        })
    return result


def dedupe_rows(rows):
    unique = []
    seen = set()
    for item in rows:
        if item["content_hash"] in seen:
            continue
        seen.add(item["content_hash"])
        unique.append(item)
    return unique


def audit(rows):
    seen = {}
    duplicate_rows = []
    for item in rows:
        if item["content_hash"] in seen:
            duplicate_rows.append((item["source_row"], seen[item["content_hash"]]))
        else:
            seen[item["content_hash"]] = item["source_row"]
    return {
        "source_rows": len(rows),
        "unique_scripts": len(seen),
        "duplicate_rows": duplicate_rows,
        "missing_title_1": sum(not r["title_1"] for r in rows),
        "missing_title_2": sum(not r["title_2"] for r in rows),
        "missing_title_3": sum(not r["title_3"] for r in rows),
    }


def write_configured_database(rows, *, confirm_production=False):
    server.load_local_env()
    engine = server.database_engine()
    if engine == "postgresql" and not confirm_production:
        raise SystemExit("安全限制：当前是 PostgreSQL。正式 RDS 写入必须额外传 --confirm-production。")
    server.initialize_database()
    store.initialize_script_library(server.database, server.database_engine)
    return engine, store.upsert_scripts(server.database, dedupe_rows(rows))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("excel", type=Path)
    p.add_argument("--write", action="store_true", help="将去重后的脚本写入当前配置数据库")
    p.add_argument("--confirm-production", action="store_true", help="仅在明确允许正式 RDS 写入时使用")
    p.add_argument("--report", type=Path)
    args = p.parse_args()

    rows = load_rows(args.excel)
    report = audit(rows)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if args.report:
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    if not args.write:
        print("dry-run 完成：未写入任何数据库。")
        return

    engine, result = write_configured_database(rows, confirm_production=args.confirm_production)
    print(f"写入完成：engine={engine}, processed={result['processed']}, total={result['total']}")


if __name__ == "__main__":
    main()
