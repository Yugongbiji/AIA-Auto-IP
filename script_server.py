"""AIA Auto IP server entrypoint with Script Recommendation V1 APIs.

This keeps the existing large `server.py` stable: all old routes are delegated to
`server.AppHandler`; only `/api/scripts/*` is handled here.
"""
from __future__ import annotations

import argparse
import json
import os
from http import HTTPStatus
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import server as core
from backend import script_api
import script_library_store as script_store


def dedicated_script_database_enabled() -> bool:
    required = ("SCRIPT_DB_HOST", "SCRIPT_DB_NAME", "SCRIPT_DB_USER", "SCRIPT_DB_PASSWORD")
    return all(os.getenv(key, "").strip() for key in required)


def script_database():
    """Use a dedicated PostgreSQL connection for the script library when configured.

    This deliberately keeps the rest of AIA Auto IP on its existing database. Only
    `/api/scripts/*` reads/writes the script RDS connection, which avoids migrating
    IP profiles, conversations and other production data as part of Script V1.
    """
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
        path = urlparse(self.path).path
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

    # Preview/local SQLite owns its own tables. Production's dedicated script RDS
    # tables are provisioned separately with least-privilege credentials, so the
    # web process must not require CREATE TABLE / CREATE INDEX privileges there.
    if not dedicated_script_database_enabled():
        script_store.initialize_script_library(script_database, script_database_engine)
    else:
        # Fail fast if the dedicated script database cannot be read.
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
