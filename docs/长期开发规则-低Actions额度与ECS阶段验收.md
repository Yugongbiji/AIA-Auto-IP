# AIA Auto IP 长期开发规则：低 Actions 额度 + ECS 阶段验收

> 生效日期：2026-08-24
>
> 目标：真正落实“开发优先、阶段验收、一次发布、失败先诊断”，避免每个小提交都消耗 GitHub-hosted Actions 分钟，也避免为了省额度而降低质量。

## 1. 总原则

1. GitHub 是唯一代码真源，业务代码仍通过开发分支 / PR 管理。
2. 日常连续开发不自动运行完整 GitHub-hosted QA，也不自动部署 Preview。
3. 同一阶段的连续产品修改允许集中完成，只做与当前改动直接相关的必要检查。
4. 到自然验收节点后，再统一更新一次 Preview，由产品负责人集中业务验收。
5. 阶段收口或准备合并 main 时，再执行完整 QA。
6. 正式发布只在明确允许合并 / 上线后发生。
7. 任何测试或部署失败先读日志、找根因；禁止通过连续提交碰运气。

## 2. GitHub Actions 使用规则

### 日常开发

- PR 每次 commit **不自动运行 Frontend QA**。
- PR 每次 commit **不自动部署 Preview**。
- 不把“提交代码”与“消耗一次完整 CI / 部署”绑定。
- 修改 workflow 本身也要遵守最小触发原则。

### 阶段验收

优先使用 ECS 本机环境执行：

- 与本轮改动相关的后端单测；
- 与本轮改动相关的 Playwright / 页面冒烟测试；
- Preview 服务更新与健康检查。

GitHub-hosted Actions 作为最终门禁或人工明确触发的补充，不承担日常开发循环。

### main

`main` 仍是正式环境唯一发布来源。合并 main 前必须完成阶段验收；main 的正式发布保护、健康检查与回滚机制不得因节省 Actions 分钟而取消。

## 3. 当前 workflow 触发策略

### Frontend QA

`.github/workflows/frontend-ci.yml`

- 不再监听 `pull_request`；
- 支持 `workflow_dispatch` 人工最终门禁；
- main 更新后仍允许执行一次完整 QA；
- 报告保留期缩短，减少无价值存储。

### Deploy Preview

`.github/workflows/preview-deploy.yml`

- 不再监听每次 PR 更新；
- 改为 `workflow_dispatch`，只有到了自然验收节点才部署；
- 手动触发时明确指定要部署的开发分支；
- Preview 与 Production 继续保持目录、端口、SQLite 用户数据隔离；
- Preview 仍从生产只读同步必要的脚本库、报名资料、已保存资料与 peer review 基线。

## 4. ECS 阶段验收标准流程

自然验收节点执行一次：

`开发分支累计修改 → ECS 拉取该分支 → 相关测试 → 更新 Preview → Preview 健康检查 → 产品集中验收`

不得变成：

`改一项 → 完整 QA → Preview → 再改一项 → 完整 QA → Preview`

### 阶段验收最低要求

- 正式服务 `127.0.0.1:8000` 健康；
- Preview 使用独立 `8001` 服务；
- Preview 不向 Production 写用户测试数据；
- 当前阶段直接相关的自动回归通过；
- Preview 页面健康检查通过；
- 验收时记录 Preview commit，避免误验旧版本。

## 5. 完整 QA 什么时候跑

只在以下场景运行完整 Frontend QA：

1. 一个完整产品阶段准备收口；
2. 准备将 PR 合并 main；
3. 修改公共组件、路由、数据隔离等高风险基础设施且需要完整回归；
4. 产品负责人明确要求跑全量 QA。

普通文字、布局、单一字段映射等连续修改，不逐项跑全量 QA。

## 6. Actions 额度保护

- 发现当月 Actions 使用明显异常时，先检查 workflow 触发次数和单次耗时，不先购买更多额度。
- 同一个 commit 不重复跑相同的完整流程。
- 失败任务有日志时先诊断日志；无 steps 且账户额度耗尽时，直接记录为“额度阻塞”，不创建新提交重试。
- GitHub-hosted runner 的依赖安装、Chromium 安装、完整 E2E 属于高耗时动作，只放在必要门禁。
- 如果 ECS 长期承担 QA，优先考虑将 ECS 配置为 GitHub self-hosted runner，让流程仍保留在 Actions UI 中，但计算资源由 ECS 提供。

## 7. 前端防“拆东墙补西墙”规则

Actions 节流不能替代工程收敛。当前多层 `product-rules-v*.js` 已出现后加载脚本覆盖前面规则的实际回归，因此：

1. 最终页面行为必须有唯一集成入口；
2. 同一核心函数不得无限 monkey-patch；
3. 新需求先找唯一真源 / 公共组件 / 最终渲染层，再决定修改位置；
4. 自动测试必须验证最终 DOM 和真实用户路径，不只测试辅助函数；
5. 阶段收口后安排一次“不改变业务行为”的规则收敛，减少历史 product-rules 层数。

## 8. 决策优先级

发生冲突时按以下优先级处理：

1. 正式环境安全；
2. 用户数据隔离与可恢复；
3. 已确认产品需求与回归契约；
4. 阶段验收质量；
5. 开发效率；
6. GitHub Actions 额度成本。

节省额度不能以跳过必要安全检查为代价；同样，也不能用“更安全”为理由让每个小修改都跑完整发布流水线。
