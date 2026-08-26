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

# 只检查 ECS 当前 HEAD 之上的工作区改动；绝不拿旧 HEAD 与新 GitHub 做全量 diff。
# 若某个脏文件的当前内容已经与 GitHub 最新分支一致，则它只是“本地提前改到同样结果”，可安全对齐。
mapfile -t TRACKED_DIRTY < <(git diff --name-only HEAD --)
REAL_LOCAL=()
for path in "${TRACKED_DIRTY[@]}"; do
  [[ -n "$path" ]] || continue
  if git cat-file -e "origin/$BRANCH:$path" 2>/dev/null; then
    if [[ -f "$path" ]] && cmp -s "$path" <(git show "origin/$BRANCH:$path"); then
      echo "✅ $path 的 ECS 本地修改已存在于 GitHub 最新分支。"
      continue
    fi
  else
    # 远端不存在该路径：只有本地文件也不存在时才算无真实差异。
    [[ ! -e "$path" ]] && continue
  fi
  REAL_LOCAL+=("$path")
done

if ((${#REAL_LOCAL[@]})); then
  echo "ECS_REAL_LOCAL_CHANGES_BEGIN"
  printf ' %s\n' "${REAL_LOCAL[@]}"
  # 只展示这些真实本地修改相对 ECS 当前 HEAD 的补丁，并强制禁用 pager。
  git --no-pager diff --no-ext-diff --binary HEAD -- "${REAL_LOCAL[@]}" || true
  echo "ECS_REAL_LOCAL_CHANGES_END"
  fail "ECS 仍有 GitHub 最新分支未包含的真实本地修改；已停止，没有 reset、没有碰数据库。"
fi

LOCAL_ONLY_COMMITS="$(git rev-list --count "origin/$BRANCH..HEAD" 2>/dev/null || echo 0)"
if [[ "$LOCAL_ONLY_COMMITS" != "0" ]]; then
  echo "ECS_LOCAL_COMMITS_BEGIN"
  git --no-pager log --oneline --decorate "origin/$BRANCH..HEAD" || true
  echo "ECS_LOCAL_COMMITS_END"
  fail "ECS 存在尚未 push 的本地 commit；已停止，没有 reset、没有碰数据库。"
fi

# 允许运行时/数据文件。其余未跟踪代码只有与远端同路径同内容时才自动清理重复副本。
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

# 到这里确认没有 ECS 独有代码。只对齐 tracked 代码，不碰 data/ SQLite 和 .env。
git reset --hard "origin/$BRANCH"
echo "✅ ECS 代码同步边界确认完成；开始正式 Preview 收口脚本。"
exec env GIT_PAGER=cat PAGER=cat bash <(git show "origin/$BRANCH:scripts/release_preview_stable.sh") "$BRANCH"
