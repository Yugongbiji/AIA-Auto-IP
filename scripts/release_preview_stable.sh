#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-agent/ip-product-optimization-20260821}"
PREVIEW_DIR="${AIA_PREVIEW_DIR:-/opt/AIA-Auto-IP-preview}"
SERVICE="${AIA_PREVIEW_SERVICE:-aia-auto-ip-preview}"
PORT="${AIA_PREVIEW_PORT:-8001}"
EXPECTED_STABLE="${AIA_EXPECTED_STABLE:-57}"
CACHE_VERSION="20260826-release1"

log(){ printf '\n[%s] %s\n' "$(date '+%F %T')" "$*"; }
fail(){ echo "❌ $*" >&2; exit 1; }

[[ "$(id -u)" -eq 0 ]] || fail "请用 root/sudo 执行。"
[[ "$PREVIEW_DIR" == *preview* ]] || fail "安全拒绝：目录不像 Preview：$PREVIEW_DIR"
[[ -d "$PREVIEW_DIR/.git" ]] || fail "Preview 仓库不存在：$PREVIEW_DIR"

log "0/8 正式站只读健康保护"
systemctl is-active --quiet aia-auto-ip || fail "正式服务不是 active，停止 Preview 发布。"
curl -fsS --retry 3 http://127.0.0.1:8000/ >/dev/null || fail "正式站本机健康检查失败。"

log "1/8 先识别 ECS 尚未 push 的代码，绝不直接覆盖"
cd "$PREVIEW_DIR"
git fetch origin "$BRANCH"
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "ECS_TRACKED_CHANGES_BEGIN"
  git status --short --untracked-files=no
  git diff --no-ext-diff --binary || true
  echo "ECS_TRACKED_CHANGES_END"
  fail "ECS 存在尚未同步的 tracked 修改；已输出 diff，本脚本没有 reset、没有碰数据库。"
fi
LOCAL_ONLY_COMMITS="$(git rev-list --count "origin/$BRANCH..HEAD" 2>/dev/null || echo 0)"
if [[ "$LOCAL_ONLY_COMMITS" != "0" ]]; then
  echo "ECS_LOCAL_COMMITS_BEGIN"
  git log --oneline --decorate "origin/$BRANCH..HEAD" || true
  echo "ECS_LOCAL_COMMITS_END"
  fail "ECS 存在尚未 push 的本地 commit；已停止，没有 reset、没有碰数据库。"
fi
UNTRACKED_CODE="$(git ls-files --others --exclude-standard | grep -Ev '^(data/|\.env($|\.)|\.venv/|\.pytest_cache/|node_modules/|playwright-report/|test-results/|__pycache__/|.*\.pyc$|.*\.(xlsx|xls|sqlite3?|db|bak|backup)$)' || true)"
if [[ -n "$UNTRACKED_CODE" ]]; then
  echo "ECS_UNTRACKED_CODE_BEGIN"
  printf '%s\n' "$UNTRACKED_CODE"
  echo "ECS_UNTRACKED_CODE_END"
  fail "ECS 存在未跟踪代码/文件；为避免覆盖，停止发布。"
fi

log "2/8 同步 GitHub 当前开发分支，只更新代码"
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"
HEAD_SHA="$(git rev-parse HEAD)"
echo "PREVIEW_HEAD=$HEAD_SHA"
[[ -f .env ]] || fail "缺少 Preview .env"
grep -Eq "^[[:space:]]*DB_ENGINE[[:space:]]*=[[:space:]]*(sqlite|'sqlite'|\"sqlite\")[[:space:]]*$" .env || fail "Preview 不是 SQLite，拒绝继续。"
[[ -f data/persona.sqlite3 ]] || fail "缺少 Preview SQLite：data/persona.sqlite3"

log "3/8 发布前锁定 57 人稳定稿"
.venv/bin/python - "$EXPECTED_STABLE" <<'PY'
import json, sqlite3, sys
from pathlib import Path
expected=int(sys.argv[1])
conn=sqlite3.connect(Path('data/persona.sqlite3'))
tables={r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
if 'current_ip_outputs' not in tables:
    raise SystemExit('current_ip_outputs missing')
count=conn.execute('SELECT COUNT(*) FROM current_ip_outputs').fetchone()[0]
print(json.dumps({'current_ip_outputs': count}, ensure_ascii=False))
if count != expected:
    raise SystemExit(f'expected current_ip_outputs={expected}, got {count}')
PY

log "4/8 一次总门禁"
if ! .venv/bin/python -m pytest --version >/dev/null 2>&1; then
  .venv/bin/pip install -r requirements-dev.txt
fi
bash scripts/check-preview-local.sh

log "5/8 轻量部署 Preview：不清历史、不重置 SQLite"
bash scripts/deploy-preview-local.sh "$BRANCH"

log "6/8 两个稳定账号做真实 API DB-first 快验"
.venv/bin/python - "$PORT" "$EXPECTED_STABLE" <<'PY'
import json, sqlite3, sys, urllib.parse, urllib.request
from pathlib import Path
port=int(sys.argv[1]); expected_count=int(sys.argv[2])
db_path=Path('data/persona.sqlite3')

def db_rows():
    conn=sqlite3.connect(db_path); conn.row_factory=sqlite3.Row
    try:
        return conn.execute('''
          SELECT a.agent_id,a.name,c.output_json,c.proposal_version
          FROM current_ip_outputs c JOIN agents a ON a.agent_id=c.agent_id
          ORDER BY a.agent_id LIMIT 2
        ''').fetchall()
    finally:
        conn.close()

def proposal_count(agent_id):
    conn=sqlite3.connect(db_path)
    try:
        return conn.execute('SELECT COUNT(*) FROM proposals WHERE agent_id=?',(agent_id,)).fetchone()[0]
    finally:
        conn.close()

def get_json(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read().decode('utf-8'))

def post_json(url,payload):
    req=urllib.request.Request(url,data=json.dumps(payload,ensure_ascii=False).encode('utf-8'),headers={'Content-Type':'application/json'},method='POST')
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode('utf-8'))

rows=db_rows()
if len(rows) != 2:
    raise SystemExit(f'need 2 stable accounts, got {len(rows)}')
for i,row in enumerate(rows,1):
    expected=json.loads(row['output_json'])
    before=proposal_count(row['agent_id'])
    qs=urllib.parse.urlencode({'name':row['name'],'agentId':row['agent_id']})
    lookup=get_json(f'http://127.0.0.1:{port}/api/lookup?'+qs)
    if not lookup.get('matched'):
        raise SystemExit(f'lookup failed for smoke account {i}')
    proposals=lookup.get('proposals') or []
    if not proposals or not proposals[0].get('proposal',{}).get('_stableMeta',{}).get('approved'):
        raise SystemExit(f'lookup did not return stable-first for smoke account {i}')
    got=proposals[0]['proposal']
    for key in ('nickname','headline','xiaohongshuBio','videoDouyinBio'):
        if got.get(key) != expected.get(key):
            raise SystemExit(f'lookup stable field drift: account={i} key={key}')
    generated=post_json(f'http://127.0.0.1:{port}/api/generate',{'agentId':row['agent_id'],'profile':lookup.get('profile') or {}})
    if not generated.get('stable'):
        raise SystemExit(f'generate did not short-circuit stable account {i}')
    for key in ('nickname','headline','xiaohongshuBio','videoDouyinBio'):
        if generated.get('proposal',{}).get(key) != expected.get(key):
            raise SystemExit(f'generate stable field drift: account={i} key={key}')
    after=proposal_count(row['agent_id'])
    if after != before:
        raise SystemExit(f'generate created duplicate proposal history for stable account {i}: {before}->{after}')
    print(f'SMOKE_ACCOUNT_{i}={row["name"]}|{row["agent_id"]}|V{row["proposal_version"]}')
conn=sqlite3.connect(db_path)
count=conn.execute('SELECT COUNT(*) FROM current_ip_outputs').fetchone()[0]
conn.close()
print(f'CURRENT_IP_OUTPUTS_AFTER={count}')
if count != expected_count:
    raise SystemExit('stable baseline count changed during deploy')
PY

log "7/8 Cache-bust 与 Preview/正式站共同健康"
HTML="$(curl -fsS --retry 5 "http://127.0.0.1:${PORT}/")"
printf '%s' "$HTML" | grep -q "app.js?v=${CACHE_VERSION}" || fail "app.js cache-bust 未生效"
printf '%s' "$HTML" | grep -q "ip-policy-core.js?v=${CACHE_VERSION}" || fail "ip-policy-core cache-bust 未生效"
printf '%s' "$HTML" | grep -q "nickname-policy-v1.js?v=${CACHE_VERSION}" || fail "nickname policy cache-bust 未生效"
printf '%s' "$HTML" | grep -q "profile-float.css?v=${CACHE_VERSION}" || fail "profile-float cache-bust 未生效"
curl -fsS --retry 5 http://127.0.0.1/preview/ >/dev/null || fail "nginx /preview/ 失败"
systemctl is-active --quiet "$SERVICE" || fail "Preview service 不是 active"
systemctl is-active --quiet aia-auto-ip || fail "正式 service 异常"
[[ "$(git rev-parse HEAD)" == "$HEAD_SHA" ]] || fail "运行 HEAD 与门禁 HEAD 不一致"

log "8/8 发布收口结果"
echo "RELEASE_PREVIEW_GREEN=1"
echo "branch=$BRANCH"
echo "commit=$HEAD_SHA"
echo "current_ip_outputs=$EXPECTED_STABLE"
echo "preview=http://8.139.255.134/preview/"
echo "下一步：只用上面输出的 SMOKE_ACCOUNT_1 / 2 做浏览器人工快验。"
