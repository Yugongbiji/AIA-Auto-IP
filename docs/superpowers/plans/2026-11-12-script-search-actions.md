# 脚本搜索与详情页操作栏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为脚本推荐增加完整脚本库关键词搜索，并让脚本详情页固定底部只保留两个同等级操作按钮。

**Architecture:** 后端在现有 `/api/scripts/library` 查询链路增加可选 `search` 参数，服务端基于全部 active 脚本统一匹配标题、标签和正文；前端复用现有脚本库分页与详情渲染，在推荐页增加搜索表单，搜索结果进入完整脚本库模式，清空后恢复原状态。详情页固定 footer 删除上一篇/下一篇，仅保留两个 `secondary-button`，文章正文底部由 V17 注入的上一篇/下一篇继续负责文章切换。

**Tech Stack:** Python 标准库/现有脚本库 API、原生 JavaScript/CSS、Python unittest/pytest、Playwright。

**Spec:** `docs/superpowers/specs/2026-11-12-script-search-actions-design.md`

## Global Constraints

- 不改变既有个性化推荐排序、去重、分页和详情打开逻辑。
- 搜索范围覆盖后端脚本库，不只筛选当前浏览器已加载的脚本。
- 清空搜索后恢复原有个性化推荐或完整脚本库状态。
- 详情页固定区域不保留上一篇/下一篇；文章正文底部已有的上一篇/下一篇不受影响。
- 两个固定操作按钮使用同等级样式，不表达主次优先级。

## Review Focus

- 搜索关键词包含中文、大小写英文、空格或标点时，服务端应稳定匹配而不报错。
- 搜索结果为空或接口失败时，页面应显示明确状态，且清空后可恢复。
- 搜索与一级/二级标签筛选同时使用时，结果必须同时满足条件。
- 搜索模式下打开详情并执行改写/小红书排版，原有 handoff 内容不能丢失。
- 移除固定导航按钮后，V17 注入到文章正文底部的上一篇/下一篇仍应保留。

### Task 1: 后端脚本库搜索契约

**Files:**
- Modify: `backend/script_api.py`
- Modify: `script_server.py`
- Test: `tests/test_script_api.py`（如不存在则创建）
- Test: `tests/test_stability_152_157_contract.py`（补充路由契约）

**Interfaces:**
- Consumes: 现有 `store.list_active_scripts(database)` 返回的 active 脚本列表。
- Produces: `library(database, *, level1="", level2="", tag="", search="", page=1, page_size=20)`；GET `/api/scripts/library?search=<keyword>`；响应中返回规范化后的 `search` 字段。

- [ ] **Step 1: Write the failing backend tests**
  - 增加测试：关键词匹配标题、标签、正文，且不匹配的脚本被排除。
  - 增加测试：`search + level1 + level2` 组合条件为 AND。
  - 增加测试：空格/大小写归一化、空关键词等价于不搜索。
  - 增加路由静态契约：`script_server.py` 将 `search` 传入 `script_api.library`。

- [ ] **Step 2: Run the focused tests and verify failure**
  - Run: `python3 -m unittest tests/test_script_api.py -v`。
  - Expected: 新增搜索测试因 `library` 尚未接受 `search` 参数而失败。

- [ ] **Step 3: Implement the backend search**
  - 在 `backend/script_api.py` 增加 `search` 参数，使用 `casefold` 并清理空白后匹配 `title_1/title_2/title_3/level1_tag/level2_tag/body`。
  - 在现有标签过滤之后应用关键词过滤，保留原排序、分页和返回字段。
  - 在 `script_server.py` 读取 URL 的 `search` 参数并传递给 API。

- [ ] **Step 4: Run focused tests and verify pass**
  - Run: `python3 -m unittest tests/test_script_api.py tests/test_stability_152_157_contract.py -v`。
  - Expected: 所有相关测试 PASS。

- [ ] **Step 5: Commit**
  - Commit message: `feat: add full script library search`

### Task 2: 推荐页搜索与详情固定按钮

**Files:**
- Modify: `web/index.html`
- Modify: `web/script-recommendation-v1.js`
- Modify: `web/script-recommendation-v1.css`
- Test: `tests/test_product_experience_contract_round3.py`
- Test: `tests/e2e/script-recommendation.spec.js`

**Interfaces:**
- Consumes: Task 1 的 GET `/api/scripts/library?search=<keyword>`。
- Produces: 推荐页搜索表单；搜索提交、清空、分页和标签筛选状态；详情固定 footer 只包含两个 `secondary-button`。

- [ ] **Step 1: Write failing contract/E2E assertions**
  - 契约测试要求推荐脚本包含 `search` 状态/请求参数、搜索表单文案和清空入口。
  - 契约测试要求 `index.html` 不再包含 `script-detail-prev`/`script-detail-next`，且改写与小红书排版均为 `secondary-button`。
  - E2E 测试模拟搜索接口，验证关键词被 URL 编码传递、结果展示、清空恢复，以及详情页固定区域没有上一篇/下一篇。

- [ ] **Step 2: Run focused tests and verify failure**
  - Run: `python3 -m pytest tests/test_product_experience_contract_round3.py tests/e2e/script-recommendation.spec.js -q`。
  - Expected: 新增搜索与按钮断言失败。

- [ ] **Step 3: Implement UI behavior**
  - 在推荐页标题区增加搜索表单，使用 `searchQuery` 保存当前关键词；提交时切换到完整脚本库模式并调用带 `search` 参数的 library API。
  - 搜索结果复用现有卡片、分页、标签筛选和详情 handoff；清空时恢复 IP 推荐或普通脚本库。
  - 搜索中、空结果、失败状态沿用现有明确状态渲染。
  - 从 `index.html` 固定 footer 删除上一篇/下一篇，保留脚本改写和小红书排版，并将后者改为 `secondary-button`。
  - 调整 CSS 使搜索区在桌面与窄屏下保持可用，两个固定按钮视觉一致。

- [ ] **Step 4: Run focused tests and verify pass**
  - Run: `python3 -m pytest tests/test_product_experience_contract_round3.py -q`。
  - Run: `npx playwright test tests/e2e/script-recommendation.spec.js`。
  - Expected: 契约测试和脚本推荐 E2E 全部 PASS。

- [ ] **Step 5: Commit**
  - Commit message: `feat: add script recommendation search UI`

### Task 3: 全量回归与交付检查

**Files:**
- Modify: 无，除非测试暴露需要修正的实现。

**Interfaces:**
- Consumes: Task 1、Task 2 的后端和前端改动。
- Produces: 可合并的开发分支，包含测试证据与变更摘要。

- [ ] **Step 1: Run backend regression**
  - Run: `python3 -m unittest discover -s tests -p 'test*.py' -v`。
  - Expected: 全部 Python 测试 PASS。

- [ ] **Step 2: Run frontend/E2E regression**
  - Run: `npx playwright test tests/e2e/script-recommendation.spec.js`。
  - Expected: 脚本推荐用户旅程 PASS。

- [ ] **Step 3: Inspect final diff and verify requirements**
  - Confirm search is server-side, fixed footer has exactly two equal-level buttons, and article-bottom paging code remains present.
  - Confirm no production or database data mutation was performed.

- [ ] **Step 4: Commit any final test-only adjustment**
  - Commit message: `test: verify script search and detail actions`
