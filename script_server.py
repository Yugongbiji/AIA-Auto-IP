"""AIA Auto IP server entrypoint with Script Recommendation V1 APIs.

This keeps the existing large `server.py` stable: all old routes are delegated to
`server.AppHandler`; only `/api/scripts/*` is handled here.
"""
from __future__ import annotations

import argparse
import json
from http import HTTPStatus
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import server as core
from backend import script_api
import script_library_store as script_store


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
                detail = script_api.detail(core.database, raw_id)
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
                result = script_api.recommend(core.database, payload)
            else:
                result = script_api.activity(core.database, payload)
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
    script_store.initialize_script_library(core.database, core.database_engine)

    if args.migrate_sqlite:
        print("迁移完成：" + json.dumps(core.migrate_sqlite_to_postgres(), ensure_ascii=False))
        return
    if args.check_db:
        print("数据库连接正常：" + json.dumps(core.database_counts(), ensure_ascii=False))
        return
    if args.import_xlsx:
        print(f"已导入 {core.import_signup_sheet(args.import_xlsx)} 条营销员报名资料。")

    httpd = ThreadingHTTPServer(("127.0.0.1", args.port), ScriptAppHandler)
    print(f"AIA Auto IP + Script Recommendation 已启动：http://127.0.0.1:{args.port}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
