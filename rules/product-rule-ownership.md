# 产品规则 Owner 清单

> 这是 `rules/product-change-governance.md` 的配套强制清单。任何开发者修改核心产品逻辑前必须先查本表；如果需要新增 Owner，先更新本表再改代码。
> 当前产品需求事实源优先读取最新 `docs/product/CURRENT_EFFECTIVE_REQUIREMENTS_LEDGER_*.md`，再读取对应专项规则；旧 Baseline 只保留未被后续总账覆盖的维度。

## 当前唯一 Owner

| 产品输出 / 组件 | 唯一 Owner | 允许做什么 | 其他文件禁止做什么 |
|---|---|---|---|
| `primaryGoal` 拓客/增员 | `web/ip-policy-core.js` | 读取报名目的、判断是否需追问、标准化成二选一 | 不得自行重新猜目的、不得恢复“两者都要/个人品牌”作为最终目标 |
| 目标人群语义 | `web/ip-policy-core.js` | 根据 `primaryGoal` 切换客户 / 准增员对象与年龄问题 | 资料提取层不得把客户画像当准增员画像，反之亦然 |
| IP 问卷问题完整性 / 提问文案 / 保存节奏 | `web/product-rules-v13.js` | 对缺失字段逐项提问；维护学历、表达风格等题目；档案保存后台串行且不得阻塞下一题 | V27/语义分析不得修改 `state.currentQuestion`、不得替用户填写问卷字段、不得因为异步请求控制跳题 |
| IP 方案定位类输出 | `web/ip-policy-core.js` | 唯一写入 `headline/subheadline/tags/clientPortrait/advantages` | AI 原始方案、旧 Vxx 不得直接决定最终可见结果 |
| 保险主线 | `web/ip-policy-core.js` | 从受控保险业务主题或增员主题生成 | 生活兴趣不得写入主线；旧 Vxx 不得改写 |
| 内容支线最终结果 | `web/ip-policy-core.js` | 使用 `rankIpContentBranches()` 候选排序后选唯一最终支线 | 排序模块只能提供候选，不得直接写 proposal |
| 内容支线候选/排序 | `web/product-rules-v14.js` | 汇总真实证据、多来源累计、目标加权、未知方向进入统一评分 | 不得直接写 `proposal.secondaryContent` |
| 推荐昵称 | `web/nickname-policy-v1.js` | 客户高频真实称呼优先；受控人物资产生成；必须有且仅有一个人物称呼；AI 只作受控兜底 | V19/V27/V29/AI 原始昵称不得改 `nicknameOptions`；不得恢复城市/学历/荣誉机械拼接 |
| 原昵称审查 | `web/product-rules-v29.js` | 谨慎评价现有昵称、展示理由 | 不得生成推荐昵称；不得渲染客户反馈 |
| 推荐简介正文 | `web/ip-policy-core.js` | 从真实人物资产池选择最强信息，生成专业背书 / 人设记忆 / 价值服务三种简介并自动删减重复 | 旧 Vxx、AI 原始简介不得追加或替换正文 |
| 简介合规尾部 | `web/ip-policy-core.js` | 固定声明、营销服务部、执业证编号；唯一输出点 | AI、V10、V16 等不得再次追加；营销员编号不得当执业证编号 |
| Canonical IP 方案持久化 | `web/ip-policy-core.js` + `script_server.py:/api/proposal/canonical` | Core 先标准化；服务器只保存同版本 canonical JSON | Python 后端不得复制一套业务规则重新计算方案 |
| 复制前合规弹窗 | `web/product-rules-v10.js` | UI 展示“可以说/不可以说”、首次复制流程 | 不得生成简介业务数据；不得自己写 Clipboard |
| 公共 Clipboard | `web/product-rules-v28.js` (`window.aiaClipboard`) | 昵称、简介、脚本改写、小红书统一真实复制成功/失败反馈 | 其他层不得直接维护 `navigator.clipboard` 成功逻辑 |
| 公共创作 Loading / Toast | `web/product-rules-v22.js` | 在消息进入 DOM 前统一 Loading 文案；公共 Toast | 不得靠全局 MutationObserver 事后改文案 |
| 资料标准化 / 自我介绍提取 / 客户反馈展示 | `web/product-rules-v27.js` | 归一报名字段、目标感知语义提取、展示个人介绍与结构化客户反馈 | 不得改昵称、简介、内容方向、悬浮入口或问卷游标；不得用语义推断替代问卷答案 |
| 悬浮入口 | `web/profile-float.js` + `web/profile-float.css` | 独立资料抽屉、显示范围、固定安全位置、打开最新方案 | 不得重写资料业务数据；不得依赖旧 `.profile-panel` / `activeTool` / overlay 状态；不得遮挡 composer |
| 内容方向 UI | `web/product-rules-v20.js` | 读取 core 的 `contentMainline/secondaryContent` 并展示、跳转推荐脚本 | 不得重新推断主线/支线 |
| 推荐脚本数据/去重/脚本库分页/行为记录 | `web/script-recommendation-v1.js` + 后端推荐服务 | 推荐、去重、无 IP 完整库、L1/L2 筛选、真实分页、详情打开，以及曝光/详情/改写/排版 handoff activity | UI 增强层不得重新生成推荐数据 |
| 推荐脚本“换一批/今日日期/详情清理” | `web/product-rules-v21.js` | 纯展示交互 | 不得改变推荐业务归类 |
| 脚本详情上一篇/下一篇 | `web/product-rules-v17.js` | 记录当前浏览列表并调用 `aiaScriptRecommendation.openDetail()` | 不得监听整个 body，不得依赖退役推荐对象 |
| 智能改写表达风格 | `web/product-rules-v11.js` + `backend/script_persona_rules.py` | 根据账号表达风格做题材适配、格式异常重试 | 其他 IP 规则不得把生活标签当脚本风格 |
| 小红书确定性排版围栏 | `backend/xhs_formatting_contract.py` | 保留原文字词、修复孤立标点/括号行，并按 `rules/xhs-formatting-rules.md` V4 保证平均 1–2 句话至少 1 个 Emoji、任意连续 2 句至少 1 个表情锚点 | 不得改原文字词或事实；不得回退到旧的“2–3 句 / 最多连续 3 句”密度 |
| 通用多选 Composer 提交 | `web/composer-submit-v2.js` + app.js 的 `state.multiSelection/planningState.multiSelection` | 业务状态唯一真源，发送直接调用业务提交；桌面 Enter、触屏不主动唤键盘 | `interaction-v2.js` 等视觉层不得维护第二套 Set、不得隐藏按钮 `.click()` 模拟提交 |
| Composer / 自动跟随 / 视口 / 错误态 UI | `web/interaction-v2.js` | 只读取业务选择状态渲染标签；自动滚动、键盘视口、错误重试 UI | 不得拥有业务提交状态，不得再次创建隐藏确认提交链 |
| Preview API / 会话隔离 | `web/api-routing-v1.js` + `web/product-rules-v16.js` | Preview API 路由、短时只读补充、localStorage 环境隔离 | Preview 不得长时间依赖正式站，也不得读取正式会话缓存 |
| Preview 清空测试 | `web/product-rules-v25.js` | 仅 Preview 清本地会话 | 正式环境不得展示 |

## 已明确失去业务写权限的旧层

- `product-rules-v5.js`：仅直接进入/资料匹配兼容。
- `product-rules-v6.js`：仅对话 emoji。
- `product-rules-v9.js`：报名 purpose 只展示；不得创建最终目标、不得重算资料完成度。
- `product-rules-v10.js`：仅合规提醒 UI；不得写 `proposal.bios` 或 Clipboard。
- `product-rules-v12.js`：仅撤销旧内容规划入口；旧 content plan 不得影响当前导航或业务结果。
- `product-rules-v13.js`：IP 问卷补充规则 Owner；只负责问题完整性、问法/选项与非阻塞保存，不得生成任何方案业务结果。
- `product-rules-v16.js`：仅环境隔离资料缓存；不得整理简介。
- `product-rules-v19.js`：仅提供称呼辅助；不得改推荐昵称。
- `product-rules-v24.js`：仅术语/欢迎文案。
- `product-rules-v29.js`：仅原昵称审查；不得展示客户反馈或改推荐昵称。

## 已停止加载的重复层

以下文件仍可保留在 Git 历史中，但当前页面不得加载，也不得由其他脚本动态注入：

- `product-integration-v30.js`
- `product-integration-v31.js`
- `product-integration-v33.js`
- `product-rules-v15.js`
- `product-rules-v23.js`
- `product-rules-v26.js`

## 修改流程硬门禁

1. 查最新 `CURRENT_EFFECTIVE_REQUIREMENTS_LEDGER` 判断当前有效需求和版本关系。
2. 若总账委托专项规则负责细节，再查对应专项规则；旧 Baseline 只补充未被后续覆盖的维度。
3. 查本 Owner 清单确认唯一 Owner。
4. 搜索同一字段/函数/DOM 区块是否还有第二写入点。
5. 有重复 Owner 时先收回旧写权限，再修改唯一 Owner。
6. 修改同时补 contract/regression test。
7. Preview 前检查真实 `index.html` 加载链和运行时动态注入，确认 SUPERSEDED 层没有复活。
8. 检查 canonical 结果是在**下游使用前**标准化，而不是只在 render 后改 DOM。
9. 检查测试本身没有继续验证已经 SUPERSEDED 的需求。
10. 只有 Owner 契约 + 影响范围回归通过，才进入统一 Preview。

**禁止通过“再加一个最后加载脚本”解决冲突。**如果必须依靠加载顺序才能保证业务正确，就视为治理失败，不进入 Preview。
