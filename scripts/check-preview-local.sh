#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log(){ printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
fail(){ echo "❌ $*" >&2; exit 1; }
warn(){ echo "⚠️ $*" >&2; }

log "1/4 检查项目 Python 虚拟环境与 IP contract tests"
PY="$ROOT/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  fail "未找到 $PY。请先按 Preview 部署流程创建项目 .venv。"
fi
if ! "$PY" -m pytest --version >/dev/null 2>&1; then
  fail "Preview .venv 尚未安装 pytest。执行：.venv/bin/pip install -r requirements-dev.txt"
fi
"$PY" -m pytest tests/test_ip_policy_contract.py -q

log "2/4 检查 index.html 实际加载的 JavaScript 文件与可用语法门禁"
mapfile -t JS_FILES < <(grep -oE '<script src="[^"]+"' web/index.html | sed -E 's/.*src="([^"]+)"/\1/' | grep -E '\.js$')
[[ ${#JS_FILES[@]} -gt 0 ]] || fail "index.html 没有解析到任何 JS 文件。"
for rel in "${JS_FILES[@]}"; do
  file="web/$rel"
  [[ -f "$file" ]] || fail "index.html 引用了不存在的脚本：$file"
done

NODE_BIN=""
if command -v node >/dev/null 2>&1; then NODE_BIN="$(command -v node)";
elif command -v nodejs >/dev/null 2>&1; then NODE_BIN="$(command -v nodejs)";
fi

if [[ -n "$NODE_BIN" ]]; then
  for rel in "${JS_FILES[@]}"; do "$NODE_BIN" --check "web/$rel" >/dev/null; done
  echo "✅ ${#JS_FILES[@]} 个实际加载 JS 文件语法通过（$NODE_BIN）"
else
  warn "当前 ECS 未安装 node/nodejs；已完成实际加载文件存在性检查，本轮不把缺少可选语法工具误判为代码失败。"
  echo "✅ ${#JS_FILES[@]} 个实际加载 JS 文件均存在；JS 解析级门禁留给具备 Node 的本地/self-hosted QA。"
fi

log "3/4 禁止复活扫描：核心业务只能由唯一规则源拥有"
for retired in \
  product-integration-v30.js product-integration-v31.js product-integration-v33.js \
  product-rules-v15.js product-rules-v23.js product-rules-v26.js; do
  if grep -q "$retired" web/index.html; then fail "已停用脚本重新进入加载链：$retired"; fi
done

LEGACY=(
  web/product-rules-v5.js web/product-rules-v6.js web/product-rules-v10.js
  web/product-rules-v12.js web/product-rules-v13.js web/product-rules-v16.js
  web/product-rules-v19.js web/product-rules-v24.js web/product-rules-v27.js web/product-rules-v29.js
)
for file in "${LEGACY[@]}"; do
  [[ -f "$file" ]] || continue
  compact="$(tr -d '[:space:]' < "$file")"
  if grep -q 'proposal\.bios=' <<<"$compact"; then fail "旧层重新获得简介写权限：$file"; fi
  if grep -q 'proposal\.contentMainline=' <<<"$compact"; then fail "旧层重新获得内容主线写权限：$file"; fi
done

grep -q 'window.aiaIpPolicy' web/ip-policy-core.js || fail "ip-policy-core.js 未导出唯一 IP policy"
grep -q 'function complianceFooter' web/ip-policy-core.js || fail "合规尾部唯一 owner 缺失"
grep -q 'rankIpContentBranches' web/ip-policy-core.js || fail "内容支线唯一排序入口缺失"
echo "✅ 禁止复活扫描通过"

log "4/4 检查当前 Git 状态"
echo "branch: $(git branch --show-current)"
echo "commit: $(git rev-parse --short HEAD)"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "⚠️ 工作区存在未提交改动："
  git status --short
else
  echo "✅ 工作区干净"
fi

echo
echo "✅ Preview 本地必要检查全部通过；可以进入统一 Preview 部署节点。"
