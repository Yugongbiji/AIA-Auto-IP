# AIA Runtime Load Target

> Phase 2：Owner 收敛和代码链治理。
>
> 适用入口：`web/index.html`。
>
> 约束：本文件定义开发分支目标加载链；不得直接修改或部署 Production。

## 当前事实

当前入口按顺序加载基础应用、onboarding、`product-rules-v5 ~ v29` 中的大量历史脚本、推荐/交互脚本、唯一 Owner 以及两个 runtime contract。

当前风险：

- 正确结果依赖后加载脚本覆盖前序实现；
- 历史业务脚本与唯一 Owner 同时拥有最终字段写权限；
- contract 通过 monkey patch 修正运行结果，职责边界不稳定；
- 无法仅从 `index.html` 判断某个最终字段由谁写入。

## 目标原则

1. 加载顺序只表达依赖，不承担规则优先级。
2. 最终字段只能由 `AIA_CODE_OWNERSHIP_MAP.md` 指定的唯一 Owner 写入。
3. contract 负责校验和阻止非法写入，不负责再次生成或覆盖业务结果。
4. UI、导航、浮层、复制和 toast 只能消费 canonical state。
5. 不新增 `product-rules-vXX.js` 或 navigation-fix 类补丁。
6. 历史脚本退出运行链前先完成职责迁移和 contract 覆盖。

## 目标加载阶段

|阶段|目标模块|允许职责|禁止职责|
|-|-|-|-|
|1. 基础设施|`api-routing-v1.js`|API 路由与环境适配|生成业务字段|
|2. 应用内核|`app.js`|state、基础事件、API 调用和纯渲染入口|拼接或覆盖 canonical 输出|
|3. Schema|`ip-onboarding-contract-v1.js`（迁移完成后更名为稳定 schema 模块）|问卷字段、选项、必填和缺失项判断|通过后加载 patch 改写问题状态|
|4. 业务 Owner|`nickname-policy-v1.js`、`ip-policy-core.js`、`script-recommendation-v1.js`|分别写入昵称、IP canonical 输出和推荐结果|互相改写对方最终字段|
|5. 领域 UI|`release-planning-goal-v1.js`、`onboarding.js`、`profile-float.js`、`interaction-v2.js`、`composer-submit-v2.js`|交互、导航、展示、提交|生成、裁剪、替换最终业务字段|
|6. 公共 UI|`product-rules-v22.js`、`product-rules-v28.js`（职责稳定后改为无版本公共模块）|Loading/Toast、复制反馈|业务规则写入|
|7. Runtime Guard|新的 ownership guard / contract|启动时校验 Owner、非法 writer 与依赖完整性|canonicalize、持久化或覆盖业务结果|

## 目标入口顺序

```text
api-routing-v1.js
app.js

ip-question-schema.js
nickname-policy-v1.js
ip-policy-core.js
script-recommendation-v1.js

release-planning-goal-v1.js
onboarding.js
profile-float.js
interaction-v2.js
composer-submit-v2.js
ui-feedback.js

runtime-ownership-guard.js
```

文件重命名不是第一批治理的前置条件；必须先将现有职责迁移到对应 Owner，再缩短入口链。

## 退出运行链的历史范围

以下文件不得长期保留在目标加载链中：

- `product-rules-v5.js` 至 `product-rules-v29.js` 中已完成职责迁移的历史版本；
- `product-integration-v30.js`、`product-integration-v31.js`、`product-integration-v33.js` 等补丁式 integration；
- `script-recommendation-navigation-fix.js`；
- 任何以“后加载覆盖”为目的的新脚本；
- 迁移后仍修改 `proposal`、`headline`、`bios`、`nicknameOptions` 或 `currentQuestion` 的非 Owner 模块。

历史文件可留在 Git 历史中，不得仅为“可能有用”继续在浏览器运行。

## 迁移批次

### Batch 1：锁定 Owner

- 新增 runtime ownership contract。
- 锁定 `proposal/headline/bios/contentMainline/secondaryContent`、`nicknameOptions` 的唯一 Writer。
- 检测 `index.html` 禁止新增版本补丁脚本。
- 不改变现有加载链，先让违规点可被测试发现。

### Batch 2：收回 IP 与昵称写权限

- 将非 Owner 的最终字段写入改为 Owner 调用或只读渲染。
- 移除 `ip-runtime-contract-v1.js` 中的业务 canonicalize 和二次持久化职责。
- 保持 API、state 数据形状和用户可见输出兼容。

### Batch 3：收敛 Schema 与辅助能力

- 合并问卷配置和缺失项判断到单一 schema 模块。
- 保留客户反馈、内容方向、Loading/Toast、复制反馈的明确单一职责。
- 删除已无职责的历史脚本加载标签。

### Batch 4：缩短入口链

- 按目标加载顺序重排 `web/index.html`。
- 移除 navigation fix、integration patch 和已迁移的 product-rules。
- 运行完整 contract、Playwright 与 UI 回归。

## Runtime 验收条件

- `index.html` 中每个运行脚本都有唯一、可描述的职责；
- 非 Owner 不写最终业务字段；
- 调换同一阶段内无依赖模块的加载顺序不会改变业务输出；
- runtime guard 发现非法 writer 时明确失败，不静默修正；
- 方案生成、历史方案加载、昵称推荐、问卷补问和脚本推荐的 contract 全绿；
- Preview 核心旅程通过；
- Production 未修改、未重启、未部署。
