#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log(){ printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
fail(){ echo "❌ $*" >&2; exit 1; }
warn(){ echo "⚠️ $*" >&2; }

log "1/5 检查项目 Python 环境、核心契约与最新有效需求回归"
PY="$ROOT/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  fail "未找到 $PY。请先按 Preview 部署流程创建项目 .venv。"
fi
if ! "$PY" -m pytest --version >/dev/null 2>&1; then
  fail "Preview .venv 尚未安装 pytest。执行：.venv/bin/pip install -r requirements-dev.txt"
fi
"$PY" -m pytest \
  tests/test_ip_policy_contract.py \
  tests/test_nickname_naturalness_contract.py \
  tests/test_nickname_presets_contract.py \
  tests/test_preview_ui_stability_contract.py \
  tests/test_regressions_80_85.py \
  tests/test_product_experience_contract_round3.py \
  tests/test_current_effective_requirements_contract.py \
  tests/test_final_ip_output_owner_contract.py \
  tests/test_release_blockers_114_119.py \
  tests/test_release_blockers_129_133_136.py \
  tests/test_release_blockers_138_139.py \
  tests/test_release_finalization_contract.py \
  tests/test_stable_ip_baseline.py \
  tests/test_release_stable_contract.py \
  tests/backend/test_xhs_formatting_contract.py \
  tests/backend/test_script_persona_rules.py \
  -q

log "2/5 检查 Python / Shell 关键运行文件语法"
"$PY" -m py_compile \
  script_server.py \
  server.py \
  scripts/reset_preview_test_data.py \
  scripts/import_approved_ip_baseline.py \
  backend/profile_semantic.py \
  backend/script_api.py \
  backend/script_persona_rules.py \
  backend/stable_ip.py \
  backend/stable_runtime.py \
  backend/xhs_formatting_contract.py
bash -n scripts/check-preview-local.sh scripts/deploy-preview-local.sh scripts/finalize_preview_release.sh

echo "✅ Python / Shell 关键运行文件语法通过"

log "3/5 检查 index.html 实际加载的 JavaScript 文件与可用语法门禁"
# Cache-busting query strings are part of the browser URL, not the repository filename.
mapfile -t JS_FILES < <(grep -oE '<script src="[^"]+"' web/index.html | sed -E 's/.*src="([^"]+)"/\1/' | sed -E 's/[?#].*$//' | grep -E '\.js$')
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

log "4/5 禁止旧 Owner / 死链 / 全页面观察器复活"
for retired in \
  product-integration-v30.js product-integration-v31.js product-integration-v33.js \
  product-rules-v15.js product-rules-v23.js product-rules-v26.js; do
  if grep -q "$retired" web/index.html; then fail "已停用脚本重新进入 index 加载链：$retired"; fi
done

for rel in "${JS_FILES[@]}"; do
  file="web/$rel"
  for retired in product-integration-v30.js product-integration-v31.js product-integration-v33.js; do
    if grep -q "$retired" "$file"; then fail "当前加载脚本在运行时引用退役层：$file -> $retired"; fi
  done
  compact="$(tr -d '[:space:]' < "$file")"
  if grep -q 'observe(document.body' <<<"$compact"; then
    fail "当前加载脚本监听整个 document.body，存在全页面 Observer 性能回归：$file"
  fi
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

if grep -q 'window\.scriptRecommendationV1' web/product-rules-v17.js; then
  fail "脚本详情分页重新依赖退役推荐对象"
fi
if grep -q 'navigator\.clipboard' web/product-rules-v10.js; then
  fail "V10 重新获得 Clipboard 写权限"
fi
if grep -q 'renderStructuredFeedback' web/product-rules-v29.js; then
  fail "V29 重新获得客户反馈展示权限"
fi
if grep -q 'confirm\.click' web/interaction-v2.js; then
  fail "通用 Composer 重新通过隐藏确认按钮模拟提交"
fi
if grep -q 'const selected = new Set()' web/interaction-v2.js; then
  fail "通用 Composer 重新维护第二套选择状态"
fi

grep -q 'window.aiaIpPolicy' web/ip-policy-core.js || fail "ip-policy-core.js 未导出唯一 IP policy"
grep -q 'function complianceFooter' web/ip-policy-core.js || fail "合规尾部唯一 owner 缺失"
grep -q 'rankIpContentBranches' web/ip-policy-core.js || fail "内容支线唯一排序入口缺失"
grep -q '/api/proposal/canonical' web/ip-policy-core.js || fail "canonical 方案持久化调用缺失"
grep -q 'path == "/api/proposal/canonical"' script_server.py || fail "canonical 方案服务器保存入口缺失"
grep -q 'stable_runtime.install' backend/script_persona_rules.py || fail "stable runtime 未安装到服务入口"
grep -q 'current_ip_outputs' backend/stable_ip.py || fail "current_ip_outputs 稳定稿权威表缺失"
grep -q 'script-library-pagination' web/script-recommendation-v1.js || fail "无 IP 脚本库真实分页缺失"
grep -q 'aia-auto-ip-session:preview' web/api-routing-v1.js || fail "Preview 本地会话隔离缺失"
grep -q 'previewIdentityStartWorkspace' web/product-rules-v25.js || fail "Preview 旧 session 抢占保护缺失"
echo "✅ Owner / DB-first / 死链 / 性能 / 环境隔离门禁通过"

log "5/5 检查当前 Git 状态"
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
