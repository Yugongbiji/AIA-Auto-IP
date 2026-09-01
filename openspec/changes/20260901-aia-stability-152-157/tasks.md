# Tasks — AIA Stability 152–157

## Phase A — Explore / Contract

- [x] 读取当前 main 的问卷实现、城市选项、`ip-policy-core.js`、客户反馈加载链、脚本推荐 API/前端链路。
- [x] 建立 IP Profile Question Contract：字段、来源、是否必问、有效值判断、保存字段、下游消费者。
- [x] 明确城市 canonical config 的 Owner。
- [x] 明确客户反馈 evidence 的唯一查询与归一化入口。
- [x] 明确脚本推荐唯一服务入口与错误分类。

## Phase B — 先补失败测试

- [x] 城市列表包含 Spec 全量城市且无重复。
- [x] 当前用户 0 条 peer_reviews 时不得出现“多人反馈”等措辞。
- [ ] 两用户评价隔离，禁止串号。
- [ ] headline 禁止字段墙/机械字段拼接。
- [ ] 素材充足时简介人物正文至少 3 行。
- [x] contentTone 缺失必问，已有有效答案可跳过。
- [ ] 表达风格保存后脚本改写可读取。
- [x] script_library 非空时推荐脚本接口和前端链路成功的入口契约。

## Phase C — 实现

- [x] 152：新增最终问卷契约，城市选项统一为当前全量城市清单。
- [x] 153：新生成 proposal 在进入后续链路时立即调用 `aiaIpPolicy.enforceProposal()`，并通过 `/api/proposal/canonical` 回写 canonical 版本；继续验证 Owner 输出本身。
- [x] 154：无 peer review evidence 时清除 AI 原始 proposal 中“多人反馈/客户反馈/大家都说”等无证据优势措辞；继续补跨用户隔离测试。
- [ ] 155：继续验证并修正 `ip-policy-core.js` bio 组装，素材充足时满足人物正文 >=3 行。
- [x] 156：已定位正式版根因为运行 `server.py`，而脚本推荐 API 只在 `script_server.py`；Preview/部署工作流入口已确认使用 `script_server.py`，待增加发布阻断保护。
- [x] 157：恢复并最终覆盖 `contentTone` 问题，支持 1–2 项多选且缺失必问；待补下游改写读取的完整旅程测试。

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
