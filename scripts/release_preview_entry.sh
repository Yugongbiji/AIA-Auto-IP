#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-agent/ip-product-optimization-20260821}"
PREVIEW_DIR="${AIA_PREVIEW_DIR:-/opt/AIA-Auto-IP-preview}"

fail(){ echo "❌ $*" >&2; exit 1; }
[[ "$(id -u)" -eq 0 ]] || fail "请用 root/sudo 执行。"
[[ -d "$PREVIEW_DIR/.git" ]] || fail "Preview 仓库不存在：$PREVIEW_DIR"
cd "$PREVIEW_DIR"

echo "=== 发布入口：安全同步 ECS 本地代码 ==="
git fetch origin "$BRANCH"

# Compare the actual working tree directly with the latest GitHub branch.
# If local tracked edits are byte-for-byte already present upstream, they are not
# unique ECS work and can be safely aligned. Otherwise stop and show only the
# real delta against GitHub; never touch the SQLite database in this phase.
if [[ -n "$(git status --porcelain --untracked-files=no)" ]] || [[ "$(git rev-list --count "origin/$BRANCH..HEAD" 2>/dev/null || echo 0)" != "0" ]]; then
  if git diff --quiet "origin/$BRANCH" --; then
    echo "✅ ECS tracked 内容与 GitHub 最新分支完全一致；属于已同步修改，安全对齐代码。"
    git reset --hard "origin/$BRANCH"
  else
    echo "ECS_REAL_DELTA_VS_GITHUB_BEGIN"
    git status --short --untracked-files=no
    git diff --no-ext-diff --binary "origin/$BRANCH" -- || true
    echo "ECS_REAL_DELTA_VS_GITHUB_END"
    fail "ECS 仍有 GitHub 不包含的真实代码修改；已停止，没有 reset、没有碰数据库。"
  fi
fi

# Untracked runtime/data files are allowed. Untracked code is only allowed when
# GitHub already tracks the same path with identical bytes; otherwise stop.
mapfile -t UNTRACKED < <(git ls-files --others --exclude-standard | grep -Ev '^(data/|\.env($|\.)|\.venv/|\.pytest_cache/|node_modules/|playwright-report/|test-results/|__pycache__/|.*\.pyc$|.*\.(xlsx|xls|sqlite3?|db|bak|backup)$)' || true)
for path in "${UNTRACKED[@]}"; do
  [[ -n "$path" ]] || continue
  if git cat-file -e "origin/$BRANCH:$path" 2>/dev/null && cmp -s "$path" <(git show "origin/$BRANCH:$path"); then
    rm -f -- "$path"
    echo "✅ 未跟踪文件 $path 与 GitHub 完全一致，已移除本地重复副本。"
  else
    echo "ECS_UNTRACKED_CODE=$path"
    fail "发现 GitHub 不包含的未跟踪代码；已停止，没有碰数据库。"
  fi
done

echo "✅ ECS 代码同步边界确认完成；开始正式 Preview 收口脚本。"
exec bash <(git show "origin/$BRANCH:scripts/release_preview_stable.sh") "$BRANCH"
