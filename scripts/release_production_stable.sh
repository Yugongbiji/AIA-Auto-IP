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

log "0/9 保存正式站当前代码点，并阻止覆盖 ECS 本地修改"
PREVIOUS_COMMIT="$(git rev-parse HEAD)"
echo "PRODUCTION_PREVIOUS_COMMIT=$PREVIOUS_COMMIT"
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "PROD_TRACKED_CHANGES_BEGIN"
  git status --short --untracked-files=no
  git diff --no-ext-diff --binary || true
  echo "PROD_TRACKED_CHANGES_END"
  fail "正式目录存在尚未同步的 tracked 修改，已停止，未改数据库。"
fi

log "1/9 同步 main，但此时还不重启服务"
git fetch origin main
git checkout main
git reset --hard origin/main
MAIN_SHA="$(git rev-parse HEAD)"
echo "PRODUCTION_TARGET_COMMIT=$MAIN_SHA"
if [[ ! -x .venv/bin/python ]]; then
  python3 -m venv .venv
fi
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
  if [[ ${#FILES[@]} -eq 0 ]]; then
    fail "未自动找到 xlsx；请把同一份 57 人 Excel 路径作为脚本第一个参数。"
  fi
  TMP_LIST="$(mktemp)"
  printf '%s\n' "${FILES[@]}" > "$TMP_LIST"
  XLSX="$(.venv/bin/python - "$TMP_LIST" "$EXPECTED" <<'PY'
import sys
from pathlib import Path
from scripts.import_approved_ip_baseline import load_rows
from backend.stable_ip import validate_output
expected=int(sys.argv[2])
valid=[]
for raw in Path(sys.argv[1]).read_text(encoding='utf-8').splitlines():
    p=Path(raw)
    try:
        rows=load_rows(p)
        ids=[aid for aid,_ in rows]
        if len(rows)!=expected or len(set(ids))!=expected:
            continue
        if any(validate_output(output) for _,output in rows):
            continue
        valid.append(str(p))
    except Exception:
        continue
if len(valid)==1:
    print(valid[0])
elif len(valid)>1:
    print('MULTIPLE:'+'|'.join(valid))
PY
)"
  rm -f "$TMP_LIST"
  [[ -n "$XLSX" ]] || fail "找到了 xlsx，但没有任何一份通过 57/57 稳定稿结构校验。"
  if [[ "$XLSX" == MULTIPLE:* ]]; then
    echo "APPROVED_XLSX_CANDIDATES=${XLSX#MULTIPLE:}"
    fail "发现多份都能通过校验的 Excel；为防误导入，请显式传入正确文件路径。"
  fi
fi
[[ -f "$XLSX" ]] || fail "Excel 不存在：$XLSX"
echo "APPROVED_XLSX=$XLSX"

log "4/9 正式数据库 dry-run：必须 57/57"
.venv/bin/python scripts/import_approved_ip_baseline.py "$XLSX" --expected "$EXPECTED"

log "5/9 防重复写：只允许 0 → 57，或已完整一致的 57"
STATE="$(.venv/bin/python - "$XLSX" "$EXPECTED" <<'PY'
import json, sys
from pathlib import Path
import server
from backend.stable_ip import ensure_stable_schema
from scripts.import_approved_ip_baseline import load_rows
server.load_local_env(); server.initialize_database()
expected=int(sys.argv[2]); rows=load_rows(Path(sys.argv[1]))
by_id={aid:out for aid,out in rows}
with server.database() as conn:
    ensure_stable_schema(conn)
    current=conn.execute('SELECT agent_id,output_json FROM current_ip_outputs ORDER BY agent_id').fetchall()
count=len(current)
if count==0:
    print('EMPTY')
elif count==expected:
    same=all(aid in by_id and json.loads(raw)==by_id[aid] for aid,raw in [(r['agent_id'],r['output_json']) for r in current])
    print('EXACT57' if same else 'DRIFT57')
else:
    print(f'PARTIAL:{count}')
PY
)"
echo "PRODUCTION_STABLE_STATE=$STATE"
case "$STATE" in
  EMPTY)
    log "6/9 正式写入 57 人稳定稿一次"
    .venv/bin/python scripts/import_approved_ip_baseline.py "$XLSX" --expected "$EXPECTED" --commit
    ;;
  EXACT57)
    echo "ℹ️ 正式库已存在与 Excel 完全一致的 57 人稳定稿，本次跳过 commit，避免重复版本。"
    ;;
  *) fail "正式库 current_ip_outputs 不是安全的空库或完全一致 57 人状态：$STATE" ;;
esac

log "7/9 验证正式库 57 人后再切换新代码服务"
.venv/bin/python - "$EXPECTED" <<'PY'
import sys, server
from backend.stable_ip import ensure_stable_schema
server.load_local_env(); server.initialize_database(); expected=int(sys.argv[1])
with server.database() as conn:
    ensure_stable_schema(conn)
    count=conn.execute('SELECT COUNT(*) AS count FROM current_ip_outputs').fetchone()['count']
print(f'PRODUCTION_CURRENT_IP_OUTPUTS={count}')
if count != expected:
    raise SystemExit(f'expected {expected}, got {count}')
PY

OVERRIDE_DIR=/etc/systemd/system/aia-auto-ip.service.d
OVERRIDE="$OVERRIDE_DIR/10-script-server.conf"
mkdir -p "$OVERRIDE_DIR"
cat > "$OVERRIDE" <<'UNIT'
[Service]
ExecStart=
ExecStart=/opt/AIA-Auto-IP/.venv/bin/python /opt/AIA-Auto-IP/script_server.py --port 8000
UNIT
rollback_code(){
  echo "⚠️ 新代码健康检查失败，回退代码到 $PREVIOUS_COMMIT；已导入稳定稿保留为只读数据。"
  git reset --hard "$PREVIOUS_COMMIT"
  .venv/bin/pip install -r requirements.txt
  systemctl daemon-reload
  systemctl restart "$SERVICE"
  systemctl is-active --quiet "$SERVICE" || true
}
systemctl daemon-reload
systemctl restart "$SERVICE"
sleep 2
if ! systemctl is-active --quiet "$SERVICE" || ! curl -fsS --retry 5 --retry-delay 1 "http://127.0.0.1:${PORT}/" >/dev/null; then
  rollback_code
  fail "正式服务新版本启动失败，代码已回退。"
fi

log "8/9 两个稳定账号正式 API 快验 + cache-bust"
.venv/bin/python - "$PORT" <<'PY'
import json, urllib.parse, urllib.request
import server
server.load_local_env(); server.initialize_database()
with server.database() as conn:
    rows=conn.execute('''SELECT a.agent_id,a.name,c.output_json,c.proposal_version FROM current_ip_outputs c JOIN agents a ON a.agent_id=c.agent_id ORDER BY a.agent_id LIMIT 2''').fetchall()
if len(rows)!=2: raise SystemExit('need two production stable accounts')
def get(url):
    with urllib.request.urlopen(url,timeout=10) as r:return json.loads(r.read().decode())
def post(url,p):
    req=urllib.request.Request(url,data=json.dumps(p,ensure_ascii=False).encode(),headers={'Content-Type':'application/json'},method='POST')
    with urllib.request.urlopen(req,timeout=15) as r:return json.loads(r.read().decode())
port=int(sys.argv[1]) if False else None
PY
# Run the HTTP smoke in a separate block so shell can pass PORT without importing secrets.
.venv/bin/python - "$PORT" <<'PY'
import json, sys, urllib.parse, urllib.request
import server
server.load_local_env(); server.initialize_database(); port=int(sys.argv[1])
with server.database() as conn:
    rows=conn.execute('''SELECT a.agent_id,a.name,c.output_json,c.proposal_version FROM current_ip_outputs c JOIN agents a ON a.agent_id=c.agent_id ORDER BY a.agent_id LIMIT 2''').fetchall()
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
        if proposal.get(key)!=expected.get(key) or generated.get('proposal',{}).get(key)!=expected.get(key):
            raise SystemExit(f'prod stable drift account={i} key={key}')
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
