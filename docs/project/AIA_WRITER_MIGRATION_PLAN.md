# AIA Writer Migration Plan

> Phase 2：Owner 收敛和代码链治理。
>
> 基线：`agent/aia-harness-stability-20260901`；依据 `AIA_CODE_OWNERSHIP_MAP.md` 与 `AIA_DUPLICATE_WRITER_AUDIT.md` 执行。
>
> 约束：本阶段只治理开发分支代码链，不修改、不部署 Production。

## 迁移目标

将最终业务字段收敛到唯一 Owner，使历史脚本只保留展示、交互或兼容职责；最终结果不得依赖脚本加载顺序、后加载覆盖或新增补丁文件。

## Writer 迁移表

|最终字段 / 状态|唯一 Writer Owner|需收回写权限的范围|迁移完成判定|
|-|-|-|-|
|`proposal`、`headline`、`bios`、`contentMainline`、`secondaryContent`|`web/ip-policy-core.js`|`app.js`、历史 `product-rules-*.js`、integration/contract 层中的二次拼接、替换和兜底生成|所有最终 IP 输出只经 canonical policy 生成；其他层只读取与渲染|
|`nicknameOptions`|`web/nickname-policy-v1.js`|`product-rules-v19.js`、`product-rules-v27.js`、`product-rules-v29.js` 及其他昵称重写点|历史层不再生成、排序、替换昵称结果|
|简介正文与合规尾部|`web/ip-policy-core.js`|`product-rules-*.js` 中的正文追加、裁剪、合规文本覆盖|正文和尾部由 Owner 一次性输出，渲染层不修改|
|`currentQuestion` 与缺失项判断|问卷 Schema / question engine（当前入口 `web/product-rules-v13.js`）|`app.js`、onboarding、历史规则中的临时跳题和自动补值|题目顺序和完整性由同一 schema contract 决定|
|客户反馈展示数据|`web/product-rules-v27.js`|`strengths` 转换为多人评价、AI 推断或其他脚本补写 `peer_reviews`|只展示真实 `peer_reviews` 证据；空值有明确空状态|
|脚本推荐上下文与结果|`web/script-recommendation-v1.js`|`app.js`、导航修复或 UI 层中的推荐生成|UI 与导航只消费推荐结果，不重新计算|
|复制反馈|`web/product-rules-v28.js`|各模块重复 clipboard/toast 实现|统一入口负责复制与反馈|
|Loading / Toast|`web/product-rules-v22.js`|各模块自建状态和提示|统一公共状态入口，无重复写入|

## 执行顺序

1. 建立 runtime ownership contract，先锁定唯一 Owner、禁止 writer 和加载链。
2. 从 `proposal`、`headline`、`bios`、`nicknameOptions` 开始，逐个定位真实赋值点。
3. 将非 Owner 写入改为只读消费、适配调用或删除死代码；不新增 `product-rules-vXX.js`。
4. 收敛问卷状态、客户反馈和脚本推荐的跨模块写入。
5. 更新 `web/index.html`，只加载目标运行链；移除已失去职责的历史运行脚本。
6. 运行 Python contract、前端 contract 与 Playwright 核心旅程。
7. 仅在 Preview 验证；Production 保持不变。

## 每批迁移门槛

每一批代码迁移必须同时满足：

- 先有能捕获重复 writer 或错误加载链的失败测试；
- 唯一 Owner 输出结构不变，已确认业务规则不降级；
- 非 Owner 不再写最终字段；
- 不以加载顺序作为正确性条件；
- 不增加新的版本补丁脚本；
- 当前自动测试全绿；
- 不触发 Production workflow、服务重启或数据库写入。

## 回滚边界

- 每批治理使用独立 commit，可按 commit 回滚。
- 回滚只作用于开发分支代码，不回滚、覆盖或迁移 Production 数据。
- 若 Owner 输出与当前有效规则冲突，停止该批代码修改，保留测试证据并回到规则基线核对。

## 完成定义

Writer 迁移仅在以下条件全部满足时完成：

- 所有目标字段均有唯一可执行 Writer；
- 历史层只保留明确的读取、展示、交互或兼容职责；
- `web/index.html` 不再加载无职责或重复写入脚本；
- runtime ownership contract 能阻止重复 writer 回归；
- Preview 核心用户旅程通过；
- Production 未被修改。
