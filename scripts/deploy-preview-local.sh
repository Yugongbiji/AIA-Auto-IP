#!/usr/bin/env bash
set -euo pipefail

# Lightweight ECS-side Preview deploy for AIA Auto IP.
# Daily product iteration should update code only; Preview data remains isolated
# and persistent unless an explicit data-sync task is needed.
#
# Usage:
#   sudo bash scripts/deploy-preview-local.sh [branch]
# Example:
#   sudo bash scripts/deploy-preview-local.sh agent/ip-product-optimization-20260821

BRANCH="${1:-agent/ip-product-optimization-20260821}"
PREVIEW_DIR="${AIA_PREVIEW_DIR:-/opt/AIA-Auto-IP-preview}"
PROD_DIR="${AIA_PROD_DIR:-/opt/AIA-Auto-IP}"
SERVICE="${AIA_PREVIEW_SERVICE:-aia-auto-ip-preview}"
PREVIEW_PORT="${AIA_PREVIEW_PORT:-8001}"

log() { printf '\n[%s] %s\n' "$(date '+%F %T')" "$*"; }
fail() { echo "ERROR: $*" >&2; exit 1; }

[[ "$(id -u)" -eq 0 ]] || fail "请用 sudo 或 root 执行。"
[[ -d "$PROD_DIR/.git" ]] || fail "正式目录不存在或不是 Git 仓库：$PROD_DIR"

log "1/6 检查正式环境仍然健康（不会修改正式环境）"
systemctl is-active --quiet aia-auto-ip || fail "正式服务 aia-auto-ip 当前不是 active，停止 Preview 更新。"
curl -fsS --retry 3 "http://127.0.0.1:8000/" >/dev/null || fail "正式站本机健康检查失败，停止 Preview 更新。"

log "2/6 准备 Preview 仓库并切到 $BRANCH"
if [[ ! -d "$PREVIEW_DIR/.git" ]]; then
  ORIGIN_URL="$(git -C "$PROD_DIR" remote get-url origin)"
  git clone "$ORIGIN_URL" "$PREVIEW_DIR"
fi

git -C "$PREVIEW_DIR" fetch origin "$BRANCH"
git -C "$PREVIEW_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
git -C "$PREVIEW_DIR" reset --hard "origin/$BRANCH"
CURRENT_COMMIT="$(git -C "$PREVIEW_DIR" rev-parse --short HEAD)"

log "3/6 准备 Python 环境（仅 requirements 变化时安装依赖）"
if [[ ! -x "$PREVIEW_DIR/.venv/bin/python" ]]; then
  python3 -m venv "$PREVIEW_DIR/.venv"
fi
REQ_HASH_FILE="$PREVIEW_DIR/.venv/.requirements.sha256"
REQ_HASH="$(sha256sum "$PREVIEW_DIR/requirements.txt" | awk '{print $1}')"
OLD_REQ_HASH="$(cat "$REQ_HASH_FILE" 2>/dev/null || true)"
if [[ "$REQ_HASH" != "$OLD_REQ_HASH" ]]; then
  "$PREVIEW_DIR/.venv/bin/pip" install -r "$PREVIEW_DIR/requirements.txt"
  printf '%s' "$REQ_HASH" > "$REQ_HASH_FILE"
else
  echo "requirements.txt 未变化，跳过 pip install。"
fi

log "4/6 检查 Preview 环境与隔离数据库"
[[ -f "$PREVIEW_DIR/.env" ]] || fail "缺少 $PREVIEW_DIR/.env。请先保留/恢复已有 Preview 环境文件。"
grep -q '^DB_ENGINE=sqlite' "$PREVIEW_DIR/.env" || fail "Preview .env 未明确使用 DB_ENGINE=sqlite，停止以防误连正式数据库。"
[[ -f "$PREVIEW_DIR/data/aia_auto_ip.db" || -f "$PREVIEW_DIR/aia_auto_ip.db" ]] || echo "提示：未在常见路径发现 SQLite 文件；应用启动时会按项目配置处理。"

log "5/6 重启 Preview 服务"
systemctl restart "$SERVICE"
sleep 2
systemctl is-active --quiet "$SERVICE" || {
  systemctl status "$SERVICE" --no-pager -l || true
  fail "Preview 服务启动失败。"
}
curl -fsS --retry 6 --retry-delay 1 "http://127.0.0.1:${PREVIEW_PORT}/" >/dev/null || {
  journalctl -u "$SERVICE" -n 80 --no-pager || true
  fail "Preview 本机健康检查失败。"
}

log "6/6 检查公网 /preview/ 与正式站"
curl -fsS --retry 6 --retry-delay 1 "http://127.0.0.1/preview/" >/dev/null || fail "nginx /preview/ 健康检查失败。"
curl -fsS --retry 3 "http://127.0.0.1/" >/dev/null || fail "正式站 nginx 健康检查失败。"
systemctl is-active --quiet aia-auto-ip || fail "正式服务在 Preview 更新后异常。"

cat <<EOF

✅ Preview 更新成功
branch: $BRANCH
commit: $CURRENT_COMMIT
preview: http://8.139.255.134/preview/

说明：本脚本默认只更新代码，不重新同步生产 RDS 数据。
EOF
