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

# 只把“相对 ECS 当前 HEAD 的工作区改动”视为本地修改。
# ECS 当前 HEAD 落后于 GitHub 时，GitHub 新增/修改的文件绝不能被误判为 ECS 删除或本地改动。
mapfile -t TRACKED_DIRTY < <(git diff --name-only HEAD --)
if ((${#TRACKED_DIRTY[@]})); then
  REAL_LOCAL=()
  for path in "${TRACKED_DIRTY[@]}"; do
    [[ -n "$path" ]] || continue
    # 若当前工作区文件与 GitHub 最新分支同路径内容完全一致，说明该本地修改已经进入 GitHub，可安全丢弃本地重复副本。
    if [[ -f "$path" ]] && git cat-file -e "origin/$BRANCH:$path" 2>/dev/null && cmp -s "$path" <(git show "origin/$BRANCH:$path"); then
      echo "✅ $path 的 ECS 本地修改已存在于 GitHub 最新分支。"
    else
      REAL_LOCAL+=("$path")
    fi
  done

  if ((${#REAL_LOCAL[@]})); then
    echo "ECS_REAL_LOCAL_CHANGES_BEGIN"
    printf ' %s\n' "${REAL_LOCAL[@]}"
    # 这里只展示真正相对 ECS 当前 HEAD 的本地补丁；禁用 pager，避免终端看起来像卡住。
    git --no-pager diff --no-ext-diff --binary HEAD -- "${REAL_LOCAL[@]}" || true
    echo "ECS_REAL_LOCAL_CHANGES_END"
    fail "ECS 仍有 GitHub 最新分支未包含的真实本地修改；已停止，没有 reset、没有碰数据库。"
  fi

  echo "✅ ECS tracked 本地修改均已在 GitHub 中，准备安全对齐代码。"
fi

# 若 ECS 有本地 commit，仅当这些 commit 尚未包含在远端时阻止。
LOCAL_ONLY_COMMITS="$(git rev-list --count "origin/$BRANCH..HEAD" 2>/dev/null || echo 0)"
if [[ "$LOCAL_ONLY_COMMITS" != "0" ]]; then
  echo "ECS_LOCAL_COMMITS_BEGIN"
  git --no-pager log --oneline --decorate "origin/$BRANCH..HEAD" || true
  echo "ECS_LOCAL_COMMITS_END"
  fail "ECS 存在尚未 push 的本地 commit；已停止，没有 reset、没有碰数据库。"
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

# 到这里已经确认没有 ECS 独有代码；仅同步 Git 代码，不动 data/ 下 SQLite 和 .env。
git reset --hard "origin/$BRANCH"
echo "✅ ECS 代码同步边界确认完成；开始正式 Preview 收口脚本。"
exec bash <(git show "origin/$BRANCH:scripts/release_preview_stable.sh") "$BRANCH"
