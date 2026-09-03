#!/usr/bin/env python3
"""Nanjing Huijia importer v2: preserve the safe importer and recover verified review-ID typos."""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts import import_nanjing_huijia_20260903 as base

# Verified against the authoritative 57-person roster plus the review row's name/nickname evidence.
REVIEW_ID_ALIASES = {
    "120593336（疑似120593332曹晶）": "120593332",  # 曹晶
    "120830523（120830532管文竹）": "120830532",      # 管文竹
    "120985082": "120982082",                        # 赵锦
    "121001878": "121015819",                        # review nickname=李念; roster 李念
    "121063816（疑似魏澳龙）": "121072535",            # 魏澳龙
}


def load_reviews_v2(path: Path, roster: dict):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = ws.iter_rows(values_only=True)
    headers = [base.clean(x) for x in next(rows)]
    idx = {h: i for i, h in enumerate(headers)}
    required = {
        "nickname": "1. 生活中你怎么称呼TA",
        "relationship": "2.你和TA的关系？",
        "traits": "3. 如果只能选3个词形容TA，你会选？",
        "topics": "4. 遇到什么事情，你比较愿意找TA聊聊？",
        "roles": "5. 如果把TA介绍给朋友，你觉得TA更像哪种人？",
        "intro": "6. 如果只能用一句话把TA介绍给一个不认识的人，你会怎么说？",
        "agentId": "7.请输入分享给你问卷的营销员信息",
    }
    missing = [h for h in required.values() if h not in idx]
    if missing:
        raise RuntimeError("客户反馈表缺列：" + "；".join(missing))

    grouped = defaultdict(list)
    corrected = []
    unmatched = []
    for excel_row, row in enumerate(rows, start=2):
        raw_aid = base.clean(row[idx[required["agentId"]]])
        aid = raw_aid if raw_aid in roster else REVIEW_ID_ALIASES.get(raw_aid, "")
        if aid:
            corrected_name = roster[aid]["name"]
            if raw_aid != aid:
                corrected.append({"row": excel_row, "rawAgentId": raw_aid, "agentId": aid, "name": corrected_name})
            grouped[aid].append({
                "nickname": base.clean(row[idx[required["nickname"]]]),
                "relationship": base.clean(row[idx[required["relationship"]]]),
                "traits": base.clean(row[idx[required["traits"]]]),
                "topics": base.clean(row[idx[required["topics"]]]),
                "roles": base.clean(row[idx[required["roles"]]]),
                "intro": base.clean(row[idx[required["intro"]]]),
            })
        else:
            unmatched.append({"row": excel_row, "rawAgentId": raw_aid, "nickname": base.clean(row[idx[required["nickname"]]])})

    print(json.dumps({"correctedReviews": corrected, "unmatchedReviews": unmatched}, ensure_ascii=False, indent=2))
    if len(corrected) != 5 or len(unmatched) != 1 or unmatched[0]["rawAgentId"] != "121021201":
        raise RuntimeError("客户反馈异常行数量与已核验结果不一致，停止导入。")
    return grouped


base.load_reviews = load_reviews_v2

if __name__ == "__main__":
    base.main()
