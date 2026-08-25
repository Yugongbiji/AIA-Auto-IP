#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-agent/ip-product-optimization-20260821}"
PREVIEW_DIR="${AIA_PREVIEW_DIR:-/opt/AIA-Auto-IP-preview}"
SERVICE="${AIA_PREVIEW_SERVICE:-aia-auto-ip-preview}"
PREVIEW_PORT="${AIA_PREVIEW_PORT:-8001}"

log(){ printf '\n[%s] %s\n' "$(date '+%F %T')" "$*"; }
fail(){ echo "ERROR: $*" >&2; exit 1; }

[[ "$(id -u)" -eq 0 ]] || fail "请用 root/sudo 执行。"
[[ "$PREVIEW_DIR" == *preview* ]] || fail "安全拒绝：目录不像 Preview：$PREVIEW_DIR"
[[ -d "$PREVIEW_DIR/.git" ]] || fail "Preview 仓库不存在：$PREVIEW_DIR"

log "1/7 拉取最终开发分支"
git -C "$PREVIEW_DIR" fetch origin "$BRANCH"
git -C "$PREVIEW_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
git -C "$PREVIEW_DIR" reset --hard "origin/$BRANCH"
HEAD_SHA="$(git -C "$PREVIEW_DIR" rev-parse HEAD)"
echo "HEAD: $HEAD_SHA"

log "2/7 确认 Preview 数据隔离"
[[ -f "$PREVIEW_DIR/.env" ]] || fail "缺少 Preview .env"
grep -Eq "^[[:space:]]*DB_ENGINE[[:space:]]*=[[:space:]]*(sqlite|'sqlite'|\"sqlite\")[[:space:]]*$" "$PREVIEW_DIR/.env" || fail "DB_ENGINE 不是 sqlite，拒绝继续，防止误碰正式 RDS。"
[[ -f "$PREVIEW_DIR/data/persona.sqlite3" ]] || fail "缺少 Preview SQLite：data/persona.sqlite3"

log "3/7 跑完整发布门禁（含 Node 解析 32 个实际加载 JS）"
cd "$PREVIEW_DIR"
bash scripts/check-preview-local.sh

log "4/7 只读预检 Preview 测试历史"
"$PREVIEW_DIR/.venv/bin/python" scripts/reset_preview_test_data.py

log "5/7 停止 Preview，备份并清理测试历史，再导入 57 人昵称预设"
systemctl stop "$SERVICE"
restart_on_exit=1
trap 'if [[ "${restart_on_exit:-0}" == 1 ]]; then systemctl start "$SERVICE" || true; fi' EXIT
"$PREVIEW_DIR/.venv/bin/python" scripts/reset_preview_test_data.py --apply
PYTHONPATH="$PREVIEW_DIR" "$PREVIEW_DIR/.venv/bin/python" scripts/import_nickname_presets.py

log "6/7 重启 Preview 并检查本机/反代健康"
systemctl start "$SERVICE"
sleep 2
systemctl is-active --quiet "$SERVICE" || {
  systemctl status "$SERVICE" --no-pager -l || true
  fail "Preview 服务启动失败"
}
curl -fsS --retry 6 --retry-delay 1 "http://127.0.0.1:${PREVIEW_PORT}/" >/dev/null || fail "Preview 服务本机 GET 失败"
curl -fsS --retry 6 --retry-delay 1 "http://127.0.0.1/preview/" >/dev/null || fail "nginx /preview/ GET 失败"
restart_on_exit=0
trap - EXIT

log "7/7 输出最终验收信息"
ACTUAL_SHA="$(git -C "$PREVIEW_DIR" rev-parse HEAD)"
[[ "$ACTUAL_SHA" == "$HEAD_SHA" ]] || fail "运行 HEAD 与门禁 HEAD 不一致"
cat <<EOF

✅ Preview 最终收口脚本执行完成
branch: $BRANCH
commit: $ACTUAL_SHA
service: $(systemctl is-active "$SERVICE")
preview: http://8.139.255.134/preview/

已完成：
- 完整发布门禁
- 32 个实际加载 JS 的 Node 语法检查
- Preview SQLite 安全备份
- 测试对话 / IP方案 / 内容规划 / 创作历史 / 推荐点击历史清零
- 原始 agents 保留
- 现有 nickname 相关 saved_profiles 字段保留
- 仓库 57 人 approved nicknamePreset 已导入 Preview 并由导入脚本校验 57/57

下一步只做浏览器最终验收，不要直接合并 main。
EOF
