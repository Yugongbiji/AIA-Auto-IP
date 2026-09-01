# Tasks — AIA Stability 152–157

## Phase A — Explore / Contract

- [ ] 读取当前 main 的问卷实现、城市选项、`ip-policy-core.js`、客户反馈加载链、脚本推荐 API/前端链路。
- [ ] 建立 IP Profile Question Contract：字段、来源、是否必问、有效值判断、保存字段、下游消费者。
- [ ] 明确城市 canonical config 的 Owner。
- [ ] 明确客户反馈 evidence 的唯一查询与归一化入口。
- [ ] 明确脚本推荐唯一服务入口与错误分类。

## Phase B — 先补失败测试

- [ ] 城市列表包含 Spec 全量城市且无重复。
- [ ] 当前用户 0 条 peer_reviews 时不得出现“多人反馈”等措辞。
- [ ] 两用户评价隔离，禁止串号。
- [ ] headline 禁止字段墙/机械字段拼接。
- [ ] 素材充足时简介人物正文至少 3 行。
- [ ] contentTone 缺失必问，已有有效答案可跳过。
- [ ] 表达风格保存后脚本改写可读取。
- [ ] script_library 非空时推荐脚本接口和前端链路成功。

## Phase C — 实现

- [ ] 152：城市选项迁移到单一配置源。
- [ ] 153：修正 headline 运行时 Owner/覆盖链，确保最高规则实际生效。
- [ ] 154：修正 peer review scoped evidence，清除默认/跨用户/缓存污染路径。
- [ ] 155：修正 bio 组装与兼容层覆盖，素材充足时满足人物正文 >=3 行。
- [ ] 156：修复脚本推荐数据/API/渲染链，并增加可诊断错误态。
- [ ] 157：补齐全部应收集问题，恢复表达风格问题并打通到脚本改写。

## Phase D — 自动 QA

- [ ] Unit / Contract 全绿。
- [ ] API / Integration 全绿。
- [ ] Playwright 完整用户旅程全绿。
- [ ] UI/视觉回归无已验收功能退化。
- [ ] 运行历史关键 contract，确保昵称、简介、57 人稳定底稿等不回归。

## Phase E — Preview

- [ ] 创建隔离 Preview 测试数据库，不使用 Production 实时库。
- [ ] 部署 development branch 到 Preview。
- [ ] 自动 smoke test。
- [ ] 用户集中业务验收 152–157。

## Phase F — 收口

- [ ] 不通过：回到本 change 更新 Spec/Tasks 并继续实现。
- [ ] 通过：Archive 本 change，形成规则/决策记录。
- [ ] Freeze RC。
- [ ] 提升同一 RC 到 Production。
- [ ] Production smoke test。
- [ ] 确认真实用户数据不受影响。
