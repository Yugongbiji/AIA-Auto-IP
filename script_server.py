"""AIA Auto IP server entrypoint with Script Recommendation V1 APIs.

This keeps the existing large `server.py` stable: all old routes are delegated to
`server.AppHandler`; only the focused extension routes are handled here.
"""
from __future__ import annotations

import argparse
import json
import os
from collections import Counter
from http import HTTPStatus
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import server as core
from backend import profile_semantic, script_api, script_persona_rules
import script_library_store as script_store

# Make confirmed account tone an explicit, auditable script-rewrite contract.
script_persona_rules.install(core)


def dedicated_script_database_enabled() -> bool:
    required = ("SCRIPT_DB_HOST", "SCRIPT_DB_NAME", "SCRIPT_DB_USER", "SCRIPT_DB_PASSWORD")
    return all(os.getenv(key, "").strip() for key in required)


def script_database():
    if not dedicated_script_database_enabled():
        return core.database()
    try:
        import psycopg
        from psycopg.rows import dict_row
    except ImportError as error:
        raise RuntimeError("未安装 PostgreSQL 驱动。请运行：pip install -r requirements.txt") from error
    conn = psycopg.connect(
        host=os.environ["SCRIPT_DB_HOST"].strip(),
        port=int(os.getenv("SCRIPT_DB_PORT", "5432")),
        dbname=os.environ["SCRIPT_DB_NAME"].strip(),
        user=os.environ["SCRIPT_DB_USER"].strip(),
        password=os.environ["SCRIPT_DB_PASSWORD"],
        sslmode=os.getenv("SCRIPT_DB_SSLMODE", "disable").strip() or "disable",
        connect_timeout=10,
        row_factory=dict_row,
    )
    return core.PostgresConnection(conn)


def script_database_engine() -> str:
    return "postgresql" if dedicated_script_database_enabled() else core.database_engine()


def _clean(value) -> str:
    return str(value or "").strip()


def _split_multi(value) -> list[str]:
    value = _clean(value).replace("；", ";").replace("、", ";").replace("，", ";").replace(",", ";")
    return [item.strip() for item in value.split(";") if item.strip() and item.strip() != "其他"]


def _count_items(counter: Counter) -> list[dict]:
    return [{"label": label, "count": count} for label, count in counter.most_common()]


def live_peer_review_summary(agent_id: str):
    """Build the display summary from raw reviews so the UI never depends on an old truncated cache."""
    try:
        with core.database() as conn:
            rows = conn.execute(
                "SELECT reviewer_nickname, relationship, traits, topics, roles, intro FROM peer_reviews WHERE agent_id = ? ORDER BY id",
                (agent_id,),
            ).fetchall()
    except Exception:
        return None
    if not rows:
        return None
    nicknames, relationships, traits, topics, roles = Counter(), Counter(), Counter(), Counter(), Counter()
    quotes = []
    for row in rows:
        nickname = _clean(row["reviewer_nickname"])
        relationship = _clean(row["relationship"])
        if nickname:
            nicknames[nickname] += 1
        if relationship:
            relationships[relationship] += 1
        traits.update(_split_multi(row["traits"]))
        topics.update(_split_multi(row["topics"]))
        roles.update(_split_multi(row["roles"]))
        intro = _clean(row["intro"])
        if intro and intro not in quotes:
            quotes.append(intro)
    return {
        "source": "身边人评价问卷",
        "reviewCount": len(rows),
        "topNicknames": _count_items(nicknames),
        "relationships": _count_items(relationships),
        "topTraits": _count_items(traits),
        "topTopics": _count_items(topics),
        "topRoles": _count_items(roles),
        "representativeQuotes": quotes,
    }


_base_merged_profile = core.merged_profile


def merged_profile_with_live_reviews(agent_id: str):
    result = _base_merged_profile(agent_id)
    if not result:
        return result
    summary = live_peer_review_summary(agent_id)
    if summary:
        result.setdefault("profile", {})["peerReviewSummary"] = summary
    return result


# server.AppHandler resolves merged_profile through server.py globals at request time.
core.merged_profile = merged_profile_with_live_reviews


class ScriptAppHandler(core.AppHandler):
    MAX_SCRIPT_API_BODY = 64 * 1024

    def _read_script_payload(self):
        size = int(self.headers.get("Content-Length", 0))
        if size <= 0 or size > self.MAX_SCRIPT_API_BODY:
            raise ValueError("invalid request body")
        payload = json.loads(self.rfile.read(size).decode("utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("invalid request body")
        return payload

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/api/scripts/library":
            query = parse_qs(parsed.query)
            try:
                result = script_api.library(
                    script_database,
                    level1=(query.get("level1", [""])[0] or ""),
                    level2=(query.get("level2", [""])[0] or ""),
                    tag=(query.get("tag", [""])[0] or ""),
                    page=int(query.get("page", ["1"])[0] or 1),
                    page_size=int(query.get("pageSize", ["20"])[0] or 20),
                )
            except ValueError:
                self.send_json({"error": "脚本库请求格式不正确"}, HTTPStatus.BAD_REQUEST)
                return
            self.send_json({"ok": True, **result})
            return

        prefix = "/api/scripts/"
        if path.startswith(prefix) and path != prefix:
            raw_id = path[len(prefix):].strip("/")
            try:
                detail = script_api.detail(script_database, raw_id)
            except ValueError:
                self.send_json({"error": "脚本编号不正确"}, HTTPStatus.BAD_REQUEST)
                return
            if not detail:
                self.send_json({"error": "未找到该脚本"}, HTTPStatus.NOT_FOUND)
                return
            self.send_json({"ok": True, "script": detail})
            return
        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/profile/analyze":
            try:
                payload = self._read_script_payload()
                profile = payload.get("profile") if isinstance(payload.get("profile"), dict) else {}
                result = profile_semantic.analyze(profile)
            except (ValueError, json.JSONDecodeError):
                self.send_json({"error": "资料分析请求格式不正确"}, HTTPStatus.BAD_REQUEST)
                return
            self.send_json({"ok": True, **result})
            return

        if path not in {"/api/scripts/recommend", "/api/scripts/activity"}:
            super().do_POST()
            return
        try:
            payload = self._read_script_payload()
            if path == "/api/scripts/recommend":
                result = script_api.recommend(script_database, payload)
            else:
                result = script_api.activity(script_database, payload)
        except (ValueError, json.JSONDecodeError):
            self.send_json({"error": "脚本推荐请求格式不正确"}, HTTPStatus.BAD_REQUEST)
            return
        self.send_json({"ok": True, **result})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--import-xlsx", type=Path)
    parser.add_argument("--migrate-sqlite", action="store_true")
    parser.add_argument("--check-db", action="store_true")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    core.load_local_env()
    core.initialize_database()
    if not dedicated_script_database_enabled():
        script_store.initialize_script_library(script_database, script_database_engine)
    else:
        with script_database() as conn:
            conn.execute("SELECT 1 FROM script_library LIMIT 1").fetchone()

    if args.migrate_sqlite:
        print("迁移完成：" + json.dumps(core.migrate_sqlite_to_postgres(), ensure_ascii=False))
        return
    if args.check_db:
        print("数据库连接正常：" + json.dumps(core.database_counts(), ensure_ascii=False))
        return
    if args.import_xlsx:
        print(f"已导入 {core.import_signup_sheet(args.import_xlsx)} 条营销员报名资料。")

    httpd = ThreadingHTTPServer(("127.0.0.1", args.port), ScriptAppHandler)
    source = "dedicated RDS" if dedicated_script_database_enabled() else script_database_engine()
    print(f"AIA Auto IP + Script Recommendation 已启动：http://127.0.0.1:{args.port}；script_db={source}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
