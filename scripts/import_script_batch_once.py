#!/usr/bin/env python3
"""One-off safe batch importer for low-frequency script uploads.

Usage on ECS after uploading the prepared xlsx:
  python scripts/import_script_batch_once.py /tmp/AIA脚本批量导入候选_20260824.xlsx
  python scripts/import_script_batch_once.py /tmp/AIA脚本批量导入候选_20260824.xlsx --write --confirm-production

Default is dry-run. Production write requires the dedicated SCRIPT_DB_* configuration
and an explicit --confirm-production flag.
"""
from __future__ import annotations

import argparse
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.import_script_library import dedupe_rows, load_rows
import script_library_store as store
import script_server
import server as core


def norm_title(value: str) -> str:
    return re.sub(r"[\s“”\"'《》【】！？!?，,。．:：；;、\-—_（）()\[\]]+", "", str(value or "")).lower()


def norm_body(value: str) -> str:
    return re.sub(r"\s+", "", str(value or ""))


def similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, norm_body(a), norm_body(b)).ratio()


def load_existing():
    with script_server.script_database() as conn:
        return [dict(row) for row in conn.execute(
            "SELECT script_id, title_1, body, content_hash FROM script_library WHERE status = 'active' ORDER BY script_id"
        ).fetchall()]


def audit_against_database(rows, existing):
    existing_hashes = {str(x.get("content_hash") or "") for x in existing}
    by_title = {}
    for item in existing:
        key = norm_title(item.get("title_1"))
        if key:
            by_title.setdefault(key, []).append(item)

    exact = []
    near = []
    fresh = []
    for item in dedupe_rows(rows):
        if item["content_hash"] in existing_hashes:
            exact.append(item)
            continue
        title_key = norm_title(item.get("title_1"))
        matched = None
        matched_score = 0.0
        for old in by_title.get(title_key, []):
            score = similarity(item.get("body"), old.get("body"))
            if score >= 0.90 and score > matched_score:
                matched = old
                matched_score = score
        if matched:
            near.append((item, matched, matched_score))
        else:
            fresh.append(item)
    return exact, near, fresh


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("excel", type=Path)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--confirm-production", action="store_true")
    args = parser.parse_args()

    core.load_local_env()
    if not script_server.dedicated_script_database_enabled():
        raise SystemExit("安全停止：未检测到专用 SCRIPT_DB_* 配置，不会猜测数据库。")

    rows = load_rows(args.excel)
    existing = load_existing()
    exact, near, fresh = audit_against_database(rows, existing)

    print(f"当前脚本库: {len(existing)}")
    print(f"本批文件解析: {len(rows)}")
    print(f"本批文件内去重后: {len(dedupe_rows(rows))}")
    print(f"与现有库正文完全重复: {len(exact)}")
    print(f"同标题且正文相似度>=90%的近重复: {len(near)}")
    print(f"预计真正新增: {len(fresh)}")

    if near:
        print("\n近重复示例（最多10条）:")
        for item, old, score in near[:10]:
            print(f"- {score:.1%} | 新: {item['title_1']} | 已有 script_id={old['script_id']}")

    if not args.write:
        print("\ndry-run 完成：未写数据库。确认数字后再执行 --write --confirm-production。")
        return

    if not args.confirm_production:
        raise SystemExit("安全限制：正式写入必须额外传 --confirm-production。")
    result = store.upsert_scripts(script_server.script_database, fresh)
    print(f"\n写入完成：新增处理={result['processed']}，脚本库总数={result['total']}")


if __name__ == "__main__":
    main()
