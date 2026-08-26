#!/usr/bin/env bash
set -euo pipefail

XLSX_ARG="${1:-}"
PROD_DIR="${AIA_PROD_DIR:-/opt/AIA-Auto-IP}"
PREVIEW_DIR="${AIA_PREVIEW_DIR:-/opt/AIA-Auto-IP-preview}"
SERVICE="${AIA_PROD_SERVICE:-aia-auto-ip}"
PORT="${AIA_PROD_PORT:-8000}"
EXPECTED="${AIA_EXPECTED_STABLE:-57}"
CACHE_VERSION="20260826-release1"

log(){ printf '\n[%s] %s\n' "$(date '+%F %T')" "$*"; }
fail(){ echo "❌ $*" >&2; exit 1; }

[[ "$(id -u)" -eq 0 ]] || fail "请用 root/sudo 执行。"
[[ -d "$PROD_DIR/.git" ]] || fail "正式仓库不存在：$PROD_DIR"
cd "$PROD_DIR"

log "0/9 保存正式站当前代码点，并阻止覆盖 ECS 本地代码"
PREVIOUS_COMMIT="$(git rev-parse HEAD)"
echo "PRODUCTION_PREVIOUS_COMMIT=$PREVIOUS_COMMIT"
git fetch origin main
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "PROD_TRACKED_CHANGES_BEGIN"
  git status --short --untracked-files=no
  git diff --no-ext-diff --binary || true
  echo "PROD_TRACKED_CHANGES_END"
  fail "正式目录存在尚未同步的 tracked 修改，已停止，未改数据库。"
fi
LOCAL_ONLY_COMMITS="$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)"
if [[ "$LOCAL_ONLY_COMMITS" != "0" ]]; then
  echo "PROD_LOCAL_COMMITS_BEGIN"
  git log --oneline --decorate origin/main..HEAD || true
  echo "PROD_LOCAL_COMMITS_END"
  fail "正式 ECS 存在尚未 push 的本地 commit，已停止，未改数据库。"
fi
UNTRACKED_CODE="$(git ls-files --others --exclude-standard | grep -Ev '^(data/|\.env($|\.)|\.venv/|\.pytest_cache/|node_modules/|playwright-report/|test-results/|__pycache__/|.*\.pyc$|.*\.(xlsx|xls|sqlite3?|db|bak|backup)$)' || true)"
if [[ -n "$UNTRACKED_CODE" ]]; then
  echo "PROD_UNTRACKED_CODE_BEGIN"
  printf '%s\n' "$UNTRACKED_CODE"
  echo "PROD_UNTRACKED_CODE_END"
  fail "正式 ECS 存在未跟踪代码/文件，已停止，未改数据库。"
fi

log "1/9 同步 main，但暂不重启正式服务"
git checkout main
git reset --hard origin/main
MAIN_SHA="$(git rev-parse HEAD)"
echo "PRODUCTION_TARGET_COMMIT=$MAIN_SHA"
if [[ ! -x .venv/bin/python ]]; then python3 -m venv .venv; fi
.venv/bin/pip install -r requirements.txt

log "2/9 读取正式数据库真实类型"
ENGINE="$(.venv/bin/python - <<'PY'
import server
server.load_local_env()
print(server.database_engine())
PY
)"
echo "PRODUCTION_DB_ENGINE=$ENGINE"
[[ "$ENGINE" == "postgresql" ]] || fail "正式环境数据库实际不是 postgresql；为防误写，停止发布。"

log "3/9 定位并验证同一份 57 人人工确认 Excel"
XLSX="$XLSX_ARG"
if [[ -z "$XLSX" ]]; then
  mapfile -t FILES < <(find "$PREVIEW_DIR" /root /tmp -maxdepth 5 -type f -iname '*.xlsx' -size -50M 2>/dev/null | sort -u)
  [[ ${#FILES[@]} -gt 0 ]] || fail "未自动找到 xlsx；请把同一份 57 人 Excel 路径作为脚本第一个参数。"
  TMP_LIST="$(mktemp)"; printf '%s\n' "${FILES[@]}" > "$TMP_LIST"
  XLSX="$(.venv/bin/python - "$TMP_LIST" "$EXPECTED" <<'PY'
import sys
from pathlib import Path
from scripts.import_approved_ip_baseline import load_rows
from backend.stable_ip import validate_output
expected=int(sys.argv[2]); valid=[]
for raw in Path(sys.argv[1]).read_text(encoding='utf-8').splitlines():
    p=Path(raw)
    try:
        rows=load_rows(p); ids=[aid for aid,_ in rows]
        if len(rows)==expected and len(set(ids))==expected and not any(validate_output(out) for _,out in rows): valid.append(str(p))
    except Exception: pass
if len(valid)==1: print(valid[0])
elif len(valid)>1: print('MULTIPLE:'+'|'.join(valid))
PY
)"
  rm -f "$TMP_LIST"
  [[ -n "$XLSX" ]] || fail "没有任何 xlsx 通过 57/57 稳定稿结构校验。"
  if [[ "$XLSX" == MULTIPLE:* ]]; then
    echo "APPROVED_XLSX_CANDIDATES=${XLSX#MULTIPLE:}"
    fail "有多份 Excel 都通过校验；为防误导入，请显式传入正确路径。"
  fi
fi
[[ -f "$XLSX" ]] || fail "Excel 不存在：$XLSX"
echo "APPROVED_XLSX=$XLSX"

log "4/9 正式数据库 dry-run：必须 57/57"
.venv/bin/python scripts/import_approved_ip_baseline.py "$XLSX" --expected "$EXPECTED"

log "5/9 防重复写：只允许空库，或已经与 Excel 完全一致的 57 人"
STATE="$(.venv/bin/python - "$XLSX" "$EXPECTED" <<'PY'
import json, sys
from pathlib import Path
import server
from backend.stable_ip import ensure_stable_schema
from scripts.import_approved_ip_baseline import load_rows
server.load_local_env(); server.initialize_database(); expected=int(sys.argv[2])
by_id={aid:out for aid,out in load_rows(Path(sys.argv[1]))}
with server.database() as conn:
    ensure_stable_schema(conn)
    current=conn.execute('SELECT agent_id,output_json FROM current_ip_outputs ORDER BY agent_id').fetchall()
count=len(current)
if count==0: print('EMPTY')
elif count==expected:
    same=True
    for row in current:
        raw=row['output_json']; actual=json.loads(raw) if isinstance(raw,str) else raw
        if row['agent_id'] not in by_id or actual!=by_id[row['agent_id']]: same=False; break
    print('EXACT57' if same else 'DRIFT57')
else: print(f'PARTIAL:{count}')
PY
)"
echo "PRODUCTION_STABLE_STATE=$STATE"
[[ "$STATE" == "EMPTY" || "$STATE" == "EXACT57" ]] || fail "正式库 stable 状态不安全：$STATE"

log "6/9 先切换并健康验证新代码；稳定稿尚未写入时可安全回滚"
OVERRIDE_DIR=/etc/systemd/system/aia-auto-ip.service.d
OVERRIDE="$OVERRIDE_DIR/10-script-server.conf"
OVERRIDE_BACKUP="$(mktemp)"; HAD_OVERRIDE=0
if [[ -f "$OVERRIDE" ]]; then cp "$OVERRIDE" "$OVERRIDE_BACKUP"; HAD_OVERRIDE=1; fi
restore_override(){
  if [[ "$HAD_OVERRIDE" == "1" ]]; then mkdir -p "$OVERRIDE_DIR"; cp "$OVERRIDE_BACKUP" "$OVERRIDE"; else rm -f "$OVERRIDE"; fi
}
rollback_code(){
  echo "⚠️ 新代码健康检查失败，回退到 $PREVIOUS_COMMIT。"
  git reset --hard "$PREVIOUS_COMMIT"
  .venv/bin/pip install -r requirements.txt
  restore_override
  systemctl daemon-reload
  systemctl restart "$SERVICE"
  systemctl is-active --quiet "$SERVICE" || true
  curl -fsS --retry 3 "http://127.0.0.1:${PORT}/" >/dev/null || true
}
mkdir -p "$OVERRIDE_DIR"
cat > "$OVERRIDE" <<'UNIT'
[Service]
ExecStart=
ExecStart=/opt/AIA-Auto-IP/.venv/bin/python /opt/AIA-Auto-IP/script_server.py --port 8000
UNIT
systemctl daemon-reload
systemctl restart "$SERVICE"
sleep 2
if ! systemctl is-active --quiet "$SERVICE" || ! curl -fsS --retry 5 --retry-delay 1 "http://127.0.0.1:${PORT}/" >/dev/null; then
  rollback_code
  rm -f "$OVERRIDE_BACKUP"
  fail "正式服务新版本启动失败，代码已回退。"
fi
rm -f "$OVERRIDE_BACKUP"

log "7/9 正式写入稳定稿一次，并验证 current_ip_outputs=57"
if [[ "$STATE" == "EMPTY" ]]; then
  if ! .venv/bin/python scripts/import_approved_ip_baseline.py "$XLSX" --expected "$EXPECTED" --commit; then
    fail "57 人正式导入失败；新代码仍健康运行，但正式发布未完成。"
  fi
else
  echo "ℹ️ 正式库已是与 Excel 完全一致的 57 人稳定稿，跳过 commit，避免重复版本。"
fi
.venv/bin/python - "$EXPECTED" <<'PY'
import sys, server
from backend.stable_ip import ensure_stable_schema
server.load_local_env(); server.initialize_database(); expected=int(sys.argv[1])
with server.database() as conn:
    ensure_stable_schema(conn)
    count=conn.execute('SELECT COUNT(*) AS count FROM current_ip_outputs').fetchone()['count']
print(f'PRODUCTION_CURRENT_IP_OUTPUTS={count}')
if count != expected: raise SystemExit(f'expected {expected}, got {count}')
PY

log "8/9 两个稳定账号正式 API 快验 + cache-bust"
.venv/bin/python - "$PORT" <<'PY'
import json, sys, urllib.parse, urllib.request
import server
server.load_local_env(); server.initialize_database(); port=int(sys.argv[1])
with server.database() as conn:
    rows=conn.execute('''SELECT a.agent_id,a.name,c.output_json,c.proposal_version FROM current_ip_outputs c JOIN agents a ON a.agent_id=c.agent_id ORDER BY a.agent_id LIMIT 2''').fetchall()
if len(rows)!=2: raise SystemExit('need two production stable accounts')
def get_json(url):
    with urllib.request.urlopen(url,timeout=10) as r:return json.loads(r.read().decode('utf-8'))
def post_json(url,payload):
    req=urllib.request.Request(url,data=json.dumps(payload,ensure_ascii=False).encode('utf-8'),headers={'Content-Type':'application/json'},method='POST')
    with urllib.request.urlopen(req,timeout=15) as r:return json.loads(r.read().decode('utf-8'))
for i,row in enumerate(rows,1):
    expected=json.loads(row['output_json']) if isinstance(row['output_json'],str) else row['output_json']
    qs=urllib.parse.urlencode({'name':row['name'],'agentId':row['agent_id']})
    lookup=get_json(f'http://127.0.0.1:{port}/api/lookup?'+qs)
    proposal=(lookup.get('proposals') or [{}])[0].get('proposal') or {}
    if not proposal.get('_stableMeta',{}).get('approved'): raise SystemExit(f'prod lookup not stable-first {i}')
    generated=post_json(f'http://127.0.0.1:{port}/api/generate',{'agentId':row['agent_id'],'profile':lookup.get('profile') or {}})
    if not generated.get('stable'): raise SystemExit(f'prod generate did not short-circuit {i}')
    for key in ('nickname','headline','xiaohongshuBio','videoDouyinBio'):
        if proposal.get(key)!=expected.get(key) or generated.get('proposal',{}).get(key)!=expected.get(key): raise SystemExit(f'prod stable drift account={i} key={key}')
    print(f'PROD_SMOKE_ACCOUNT_{i}={row["name"]}|{row["agent_id"]}|V{row["proposal_version"]}')
PY
HTML="$(curl -fsS --retry 5 "http://127.0.0.1:${PORT}/")"
printf '%s' "$HTML" | grep -q "app.js?v=${CACHE_VERSION}" || fail "正式 app.js cache-bust 未生效"
printf '%s' "$HTML" | grep -q "ip-policy-core.js?v=${CACHE_VERSION}" || fail "正式 IP policy cache-bust 未生效"
curl -fsS --retry 5 http://127.0.0.1/ >/dev/null || fail "正式 nginx 健康失败"

log "9/9 正式发布完成"
echo "RELEASE_PRODUCTION_GREEN=1"
echo "commit=$MAIN_SHA"
echo "db_engine=$ENGINE"
echo "current_ip_outputs=$EXPECTED"
echo "xlsx=$XLSX"
