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
- [x] 多人反馈必须同时满足真实 reviewCount >= 2 且同一特质 count >= 2。
- [x] headline 禁止“职业 + 生活里喜欢某兴趣”的机械拼接。
- [x] 素材充足时简介人物正文至少 3 行。
- [x] contentTone 缺失必问，已有有效答案可跳过。
- [x] 表达风格保存后脚本改写可读取（沿用现有表达风格下游 E2E，并改为最终问卷契约）。
- [x] script_library 非空时推荐脚本接口和前端链路成功的入口契约。

## Phase C — 实现

- [x] 152：新增最终问卷契约，城市选项统一为当前全量城市清单。
- [x] 153：新生成 proposal 立即执行 canonical IP Policy 并回写；同时移除 headline fallback 的“职业 + 兴趣”机械组合。
- [x] 154：`ip-policy-core.js` 中本人 strengths 与真实 peer reviews 分离；只有真实重复评价才允许写“多人反馈”，运行时另有无证据清理兜底。
- [x] 155：`packDimension()` 保留 12–20 优先、25 绝对上限，同时增加真实短事实的受控 6 字下限兜底，避免素材充足却被裁成 2 行；新增 E2E 验证正文 >=3 行。
- [x] 156：确认推荐 API 唯一入口为 `script_server.py`；正式部署工作流已强制 `script_server.py --port 8000` 并包含推荐接口 smoke test。下一阶段 Preview 必须继续使用该入口。
- [x] 157：问卷最终契约覆盖 primaryGoal、城市、人群/年龄、从业、优势、荣誉、学历、学校、留学、表达风格、过往职业、生活身份、爱好、真实服务、营销服务部；缺失逐项询问。

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
