#!/usr/bin/env python3
"""Safely reset Preview-only test history before final acceptance.

Hard safety boundaries:
- Only SQLite is allowed. Production PostgreSQL/RDS is refused.
- Keeps agents (raw signup records), peer_reviews and script_library.
- Keeps all nickname-related keys in saved_profiles, including approved presets/manual alternatives.
- Clears generated/test conversation, proposal, planning, creative and script-activity history.
- Creates a timestamped SQLite-consistent backup before mutation.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env"
DB_PATH = ROOT / "data" / "persona.sqlite3"
BACKUP_DIR = ROOT / "data" / "preview-reset-backups"
HISTORY_TABLES = (
    "conversation_messages",
    "proposals",
    "content_planning_messages",
    "content_plans",
    "creative_tool_messages",
    "script_user_activity",
)


def load_env_file() -> dict[str, str]:
    values: dict[str, str] = {}
    if not ENV_FILE.exists():
        raise RuntimeError(f"缺少 Preview 环境文件：{ENV_FILE}")
    for raw in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def table_exists(conn: sqlite3.Connection, table: str) -> bool:
    return conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone() is not None


def count(conn: sqlite3.Connection, table: str) -> int:
    if not table_exists(conn, table):
        return 0
    return int(conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0])


def nickname_only_profile(raw: str) -> dict:
    try:
        profile = json.loads(raw or "{}")
    except json.JSONDecodeError as exc:
        raise RuntimeError("saved_profiles 中存在无法解析的 profile_json，停止清场") from exc
    if not isinstance(profile, dict):
        raise RuntimeError("saved_profiles 中存在非对象 profile_json，停止清场")
    keep = {}
    explicit = {
        "preferredName",
        "preferredNickname",
        "manualNicknameAlternatives",
        "nicknameAlternatives",
        "nicknamePreset",
        "nicknamePresets",
    }
    for key, value in profile.items():
        normalized = str(key).lower()
        if "nickname" in normalized or key in explicit:
            keep[key] = value
    return keep


def preset_count(conn: sqlite3.Connection) -> int:
    if not table_exists(conn, "saved_profiles"):
        return 0
    total = 0
    for (raw,) in conn.execute("SELECT profile_json FROM saved_profiles"):
        try:
            profile = json.loads(raw or "{}")
        except json.JSONDecodeError:
            continue
        preset = profile.get("nicknamePreset") if isinstance(profile, dict) else None
        if isinstance(preset, dict) and preset.get("status") == "approved" and preset.get("primary"):
            total += 1
    return total


def sqlite_backup(conn: sqlite3.Connection, target: Path) -> None:
    backup_conn = sqlite3.connect(target)
    try:
        conn.backup(backup_conn)
        backup_conn.commit()
    finally:
        backup_conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="真正执行；不带此参数只做只读预检")
    args = parser.parse_args()

    env = load_env_file()
    engine = (env.get("DB_ENGINE") or "").strip().lower()
    if engine != "sqlite":
        raise RuntimeError(f"安全拒绝：当前 DB_ENGINE={engine!r}，只允许清理 Preview SQLite")
    if "preview" not in str(ROOT).lower():
        raise RuntimeError(f"安全拒绝：项目目录不像 Preview：{ROOT}")
    if not DB_PATH.exists():
        raise RuntimeError(f"Preview SQLite 不存在：{DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    try:
        before = {table: count(conn, table) for table in HISTORY_TABLES}
        before["agents"] = count(conn, "agents")
        before["saved_profiles"] = count(conn, "saved_profiles")
        before["nickname_presets"] = preset_count(conn)
        print("=== Preview 清场预检 ===")
        print(json.dumps(before, ensure_ascii=False, indent=2))

        if before["agents"] < 57:
            raise RuntimeError(f"安全拒绝：agents 只有 {before['agents']} 人，低于预期 57 人")
        if before["nickname_presets"] < 57:
            raise RuntimeError(
                f"安全拒绝：已批准 nicknamePreset 只有 {before['nickname_presets']} 人，低于预期 57 人"
            )
        if not args.apply:
            print("只读预检通过；增加 --apply 才会执行清场。")
            return 0

        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup = BACKUP_DIR / f"persona-before-reset-{stamp}.sqlite3"
        conn.commit()
        sqlite_backup(conn, backup)
        print(f"✅ 已备份：{backup}")

        conn.execute("BEGIN IMMEDIATE")
        for table in HISTORY_TABLES:
            if table_exists(conn, table):
                conn.execute(f'DELETE FROM "{table}"')

        # Preserve nickname presets/manual alternatives while removing test-time profile edits.
        if table_exists(conn, "saved_profiles"):
            rows = conn.execute("SELECT agent_id, profile_json FROM saved_profiles").fetchall()
            for agent_id, raw in rows:
                kept = nickname_only_profile(raw)
                if kept:
                    conn.execute(
                        "UPDATE saved_profiles SET profile_json=? WHERE agent_id=?",
                        (json.dumps(kept, ensure_ascii=False, separators=(",", ":")), agent_id),
                    )
                else:
                    conn.execute("DELETE FROM saved_profiles WHERE agent_id=?", (agent_id,))
        conn.commit()

        after = {table: count(conn, table) for table in HISTORY_TABLES}
        after["agents"] = count(conn, "agents")
        after["saved_profiles"] = count(conn, "saved_profiles")
        after["nickname_presets"] = preset_count(conn)

        if after["agents"] != before["agents"]:
            raise RuntimeError("清场后 agents 数量变化，立即人工检查备份")
        if after["nickname_presets"] != before["nickname_presets"]:
            raise RuntimeError("清场后 nicknamePreset 数量变化，立即人工检查备份")
        dirty = {k: v for k, v in after.items() if k in HISTORY_TABLES and v != 0}
        if dirty:
            raise RuntimeError(f"清场后仍有测试历史：{dirty}")

        print("=== Preview 清场完成 ===")
        print(json.dumps(after, ensure_ascii=False, indent=2))
        print("✅ 原始 agents 保留；昵称预设保留；测试历史归零。")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
