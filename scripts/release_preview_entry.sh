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

# Only working-tree edits relative to the current ECS HEAD count as local work.
# Two exact release deltas were reviewed on 2026-08-26 and are now represented
# upstream by the release planning-goal contract and the complete cache-bust index.
mapfile -t TRACKED_DIRTY < <(git diff --name-only HEAD --)
REAL_LOCAL=()
for path in "${TRACKED_DIRTY[@]}"; do
  [[ -n "$path" ]] || continue

  if git cat-file -e "origin/$BRANCH:$path" 2>/dev/null && [[ -f "$path" ]] && cmp -s "$path" <(git show "origin/$BRANCH:$path"); then
    echo "✅ $path 的 ECS 本地修改已存在于 GitHub 最新分支。"
    continue
  fi

  if [[ "$path" == "web/app.js" ]]; then
    NUMSTAT="$(git diff --numstat HEAD -- web/app.js | tr '\t' ' ')"
    HUNKS="$(git --no-pager diff HEAD -- web/app.js | grep -c '^@@' || true)"
    if [[ "$NUMSTAT" == "1 1 web/app.js" && "$HUNKS" == "1" ]] \
      && grep -Fq "chips: ['吸引潜在客户', '吸引潜在增员对象']" web/app.js \
      && git --no-pager diff HEAD -- web/app.js | grep -Fq "chips: ['拓客为主', '增员为主', '两者兼顾']"; then
      echo "✅ web/app.js 为已人工确认的拓客/增员二选一改动；GitHub 已由 release-planning-goal-v1.js 保持同等运行行为。"
      continue
    fi
  fi

  if [[ "$path" == "web/index.html" ]]; then
    HUNKS="$(git --no-pager diff HEAD -- web/index.html | grep -c '^@@' || true)"
    if [[ "$HUNKS" -le 2 ]] \
      && git --no-pager diff HEAD -- web/index.html | grep -Fq '?v=182f730' \
      && ! git --no-pager diff HEAD -- web/index.html | grep '^+' | grep -Ev '^\+\+\+|182f730' >/dev/null; then
      echo "✅ web/index.html 仅为已确认的旧局部 cache-bust；GitHub 当前 index 已升级为全关键资源统一 release cache-bust。"
      continue
    fi
  fi

  REAL_LOCAL+=("$path")
done

if ((${#REAL_LOCAL[@]})); then
  echo "ECS_REAL_LOCAL_CHANGES_BEGIN"
  printf ' %s\n' "${REAL_LOCAL[@]}"
  git --no-pager diff --no-ext-diff --binary HEAD -- "${REAL_LOCAL[@]}" || true
  echo "ECS_REAL_LOCAL_CHANGES_END"
  fail "ECS 仍有未经确认的真实本地修改；已停止，没有 reset、没有碰数据库。"
fi

LOCAL_ONLY_COMMITS="$(git rev-list --count "origin/$BRANCH..HEAD" 2>/dev/null || echo 0)"
if [[ "$LOCAL_ONLY_COMMITS" != "0" ]]; then
  echo "ECS_LOCAL_COMMITS_BEGIN"
  git --no-pager log --oneline --decorate "origin/$BRANCH..HEAD" || true
  echo "ECS_LOCAL_COMMITS_END"
  fail "ECS 存在尚未 push 的本地 commit；已停止，没有 reset、没有碰数据库。"
fi

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

# Only tracked code is aligned here. data/ SQLite and .env stay untouched.
git reset --hard "origin/$BRANCH"
echo "✅ ECS 代码同步边界确认完成；开始正式 Preview 收口脚本。"
exec env GIT_PAGER=cat PAGER=cat bash <(git show "origin/$BRANCH:scripts/release_preview_stable.sh") "$BRANCH"
