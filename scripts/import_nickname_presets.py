from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from server import database

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "nickname_presets_20260825.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_records() -> list[dict]:
    payload = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    records = payload.get("records") or []
    if payload.get("count") != 57 or len(records) != 57:
        raise RuntimeError(f"昵称预设数量异常：声明 {payload.get('count')}，实际 {len(records)}")
    ids = [str(item.get("agent_id", "")).strip() for item in records]
    if len(set(ids)) != 57 or any(not item for item in ids):
        raise RuntimeError("昵称预设 agent_id 缺失或重复")
    return records


def import_presets() -> None:
    records = load_records()
    updated_at = now_iso()
    written = 0

    with database() as conn:
        # 先完整校验 57 人，任何一人不存在/姓名不一致都不写，避免半批次污染。
        for item in records:
            row = conn.execute(
                "SELECT name FROM agents WHERE agent_id = ?",
                (item["agent_id"],),
            ).fetchone()
            if not row:
                raise RuntimeError(f"数据库缺少营销员：{item['name']} ({item['agent_id']})")
            db_name = row["name"] if hasattr(row, "keys") else row[0]
            if str(db_name).strip() != item["name"]:
                raise RuntimeError(
                    f"姓名不一致：{item['agent_id']} 数据库={db_name!r} 预设={item['name']!r}"
                )

        for item in records:
            row = conn.execute(
                "SELECT profile_json FROM saved_profiles WHERE agent_id = ?",
                (item["agent_id"],),
            ).fetchone()
            raw = None if not row else (row["profile_json"] if hasattr(row, "keys") else row[0])
            try:
                profile = json.loads(raw) if raw else {}
            except json.JSONDecodeError as exc:
                raise RuntimeError(f"现有 profile_json 无法解析：{item['name']}") from exc
            if not isinstance(profile, dict):
                raise RuntimeError(f"现有 profile_json 不是对象：{item['name']}")

            profile["nicknamePreset"] = {
                "primary": item["primary"],
                "status": "approved",
                "source": item.get("source") or "human_review_20260825",
                "approvedAt": "2026-08-25",
                "allowAiFallback": bool(item.get("allowAiFallback", True)),
            }
            payload = json.dumps(profile, ensure_ascii=False, separators=(",", ":"))
            conn.execute(
                """
                INSERT INTO saved_profiles(agent_id, profile_json, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(agent_id) DO UPDATE SET
                  profile_json=excluded.profile_json,
                  updated_at=excluded.updated_at
                """,
                (item["agent_id"], payload, updated_at),
            )
            written += 1

    # 二次只读校验，必须 57/57 全部命中且首选逐字一致。
    verified = 0
    with database() as conn:
        for item in records:
            row = conn.execute(
                "SELECT profile_json FROM saved_profiles WHERE agent_id = ?",
                (item["agent_id"],),
            ).fetchone()
            if not row:
                raise RuntimeError(f"写入后缺少 saved_profiles：{item['name']}")
            raw = row["profile_json"] if hasattr(row, "keys") else row[0]
            profile = json.loads(raw)
            preset = profile.get("nicknamePreset") or {}
            if preset.get("status") != "approved" or preset.get("primary") != item["primary"]:
                raise RuntimeError(f"写入校验失败：{item['name']}")
            if preset.get("allowAiFallback") is not True:
                raise RuntimeError(f"AI 兜底被意外关闭：{item['name']}")
            verified += 1

    print(f"nickname presets imported: {written}; verified: {verified}/57")


if __name__ == "__main__":
    import_presets()
