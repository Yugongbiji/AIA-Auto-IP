# AIA Auto IP — AI Development Harness

## 1. 角色分工

- 用户负责：业务需求、产品判断、Preview 业务验收、是否发布的最终确认。
- AI/Codex 负责：探索当前真实代码、梳理规则冲突、技术设计、实现、自动测试、回归测试、Preview 部署、发布收口。
- 不允许要求用户承担代码级排查、SQL 拼接、接口调试或重复发现同类回归问题。

## 2. 事实源优先级

开发前必须先读取并遵守：

1. `docs/product/CURRENT_EFFECTIVE_REQUIREMENTS_LEDGER_20260825.md`
2. 对应专项规则与审计文件，例如 `docs/product/FINAL_OUTPUT_RULE_AUDIT_20260826.md`
3. 当前 OpenSpec change 下的 spec/design/tasks
4. 未冲突的历史 baseline
5. 当前代码只能作为实现现状，不得反推或覆盖最高有效产品规则

若规则冲突，以更高优先级、更晚确认且明确覆盖旧规则的文档为准。

## 3. 标准开发流程

每一个非紧急产品修改必须走以下闭环：

`业务需求/验收问题 → Explore → Spec → Design → Tasks → 实现 → 自动测试 → Preview → 业务验收 → Archive → Freeze RC → Production → Production smoke test`

### Explore
先确认当前 main、运行时 Owner、数据结构、相关测试、历史规则、回归风险。禁止直接凭聊天历史猜代码。

### Spec
把业务要求写成可验收行为，明确：
- 正常场景
- 缺失数据场景
- 禁止行为
- 证据来源
- 回归边界

### Design
明确唯一 Owner、数据流、接口/表影响、兼容层权限、测试策略。若存在多个模块重复写同一最终字段，必须先收敛 Owner，再实现功能。

### Tasks
任务按可验证的小闭环拆分，但同一业务问题必须在同一 change 中完成，不允许一个 bug 一个临时补丁文件。

## 4. 三层自动验收门

任何进入 Preview 的版本至少通过：

1. **Unit / Contract / API**：业务规则、证据约束、字段映射、接口状态。
2. **Playwright 用户旅程**：登录 → IP资料 → 缺失项询问 → IP方案 → 脚本推荐 → 脚本改写 → 小红书排版。
3. **UI/视觉回归**：关键入口、抽屉/弹窗、响应式、错误态和历史已验收交互。

已确认的业务规则必须尽量变成自动化 contract；不得只写在 Markdown 里。

## 5. 产品规则 Owner

- 一句话 IP / 推荐简介最终写入：`web/ip-policy-core.js`
- 推荐昵称最终写入：`web/nickname-policy-v1.js`
- 兼容/UI 层不得重新生成、二次裁剪或覆盖这些最终字段。
- 新增问卷字段、城市选项、客户反馈证据、脚本推荐，也必须各自确定唯一 Owner 和唯一配置源。

## 6. 防回归原则

- 修复新问题前先补失败测试，再改实现。
- 同类问题第二次出现，必须升级为 contract 或完整用户旅程测试。
- 禁止为了修当前样本而硬编码某个姓名、城市、字段组合或测试账号输出。
- 不允许生成数据库没有证据支持的“多人反馈”“客户评价”“长期”“多年”“擅长”等描述。
- 数据为空时必须有明确空状态，不得借用其他用户、默认样本或缓存数据。

## 7. Preview 与 Production

- Preview 用于开发验收，不得默认复制、覆盖或清理 Production 真实用户数据。
- 一旦 Preview 承载真实用户数据，立即视为受保护环境，禁止 reset/clear/覆盖。
- Preview 验收通过后冻结 Release Candidate；Production 必须提升同一 RC，不得重新拼装代码。
- 代码发布和用户数据迁移是两件独立事务。
- Production 发布前必须备份数据库；发布后必须执行 smoke test。

## 8. 测试账号

Production 固定验收测试账号：
- 姓名：宋健
- 工号：111111111

自动化不得使用真实营销员账号产生写入。测试账号产生的数据必须可按 agent_id 定向清理/恢复，不影响任何真实人员与 57 人稳定底稿。

## 9. 完成定义

一个 change 只有同时满足以下条件才算完成：
- Spec 中的 acceptance criteria 全部有实现映射；
- 自动测试全绿；
- Preview 完整链路可用；
- 用户业务验收通过；
- 规则与决策已归档；
- Production smoke test 通过且无真实数据风险。
