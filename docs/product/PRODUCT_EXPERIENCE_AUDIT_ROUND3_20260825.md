# AIA Auto IP 产品效果保全审计 · 第三轮（2026-08-25）

> 目的：在前两轮静态差异审计基础上，继续从“规则 → Owner → 实际加载链 → 调用链 → 测试 → 真实用户路径”六层交叉排查，尽可能发现隐藏回归、死链、双 Owner、假测试保护和跨环境污染。
>
> 本轮仍然只做审计，不授权恢复退役 V30/V31/V33，也不直接修改产品实现。

## 一、第三轮新增结论摘要

本轮新增发现说明：当前最大的风险已经不只是“旧效果没迁完”，还包括以下更底层问题：

1. **标准化发生得太晚**：`ip-policy-core.js` 主要在 `renderProposal()` 时才规范 proposal，导致“先生成、不打开方案、直接去脚本推荐/脚本改写”时可能继续读取 AI 原始方案。
2. **服务器持久化的是 AI 原始 proposal**：`/api/generate` 在前端 Core 介入前就写入 proposals 表；刷新后仍需靠页面渲染临时纠正。
3. **访客方案不进入 `state.proposals`**：访客即使完成 IP 方案，切脚本推荐仍可能被判定为“没有 IP”。
4. **IP 方案还有无人认领字段**：`subheadline / tags / clientPortrait / advantages` 没有明确唯一 Owner，继续直接读取旧 AI 输出。
5. **Prompt 双规则源**：仓库 `prompts/ip-persona-prompt.md` 与运行时 `server.py::deepseek_generate()` 是两套独立 Prompt；运行时没有读取前者，且仍保留旧“两套简介”等结构。
6. **资料自然语言修改白名单过旧**：完成方案后，`previousCareer / lifeRoles / hobbies / services / primaryGoal` 等新字段无法通过对话修改。
7. **Preview API 隔离了，但 localStorage 没隔离**：正式站与 `/preview/` 同 origin 时共享 V16 profile cache 和 SESSION_KEY，存在跨环境本地状态污染。
8. **Preview lookup 实时依赖正式站且无明确超时**：正式站慢会拖住 Preview 登录/恢复。
9. **退役独立内容规划仍暗中影响默认导航**：旧 `contentPlans` 会导致登录后默认跳到脚本改写。
10. **客户反馈数据映射本身正确**，但客户反馈展示仍有 V27/V29 双 Owner（第二轮已发现）。
11. **资料完成度有 V8/V9 双 Owner**，且统计口径不同。
12. **Clipboard 实际有三套实现**：`app.js`、V10、V28；当前“唯一 Owner”测试是假保护。
13. **Loading/Empty/Retry 没真正公共化**：V22 主要是 DOM 后处理，小红书与脚本改写仍各自生成 loading 文案。
14. **V17 仍有全 body MutationObserver**，79 的性能治理只修了 profile-float，未覆盖同类风险。
15. **contentTone 文案允许 1～2 个，但实际题型不是 multiple**，用户只能选一个。
16. **昵称无人物锚点时仍会放行 AI 原始昵称**，可能重新出现“成都/暖心”等无人称呼昵称。
17. **内容支线多来源证据不再累计**：V14 用 `Math.max`，弱化了“多个真实来源一致”这一高价值信号。
18. **语义预填对拓客/增员不感知**：增员目标下可能把“我主要服务企业主”误填成准增员对象，从而错误跳过增员人群问题。
19. **标准化目标没有贯穿完整 IP 方案**：`clientPortrait` 与 `advantages` 仍按旧“目标客户” Prompt 输出，增员路径可能继续出现客户语义。
20. **QS/985/211 事实保护没有覆盖整个 proposal**：昵称/简介已收口，但 `advantages` 等 AI 原始字段仍可能反推具体学校。
21. **当前 Hosted Frontend QA 若重新运行，本身也会被过期测试污染**：`playwright test` 会运行所有 e2e，其中仍有要求 V30 最后加载、两行悬浮按钮等已被最新需求替代的断言。

## 二、第三轮逐项证据与判定

### A. Proposal 标准化时机错误

当前 `generateProposal()`：

- `/api/generate` 返回 `result.proposal`；
- 对 matched 用户先 `state.proposals.unshift(saved)`；
- 并未在此时调用 `aiaIpPolicy.enforceProposal()`；
- Core 的标准化主要挂在 `renderProposal()` wrapper 上。

因此存在用户路径：

`生成方案 → 不打开方案 → 直接脚本推荐`

此时 `latestProposal()` 读取的可能是 AI 原始 proposal，而不是标准化主线/支线。

**判定：确定结构缺陷。**

### B. 服务器保存 AI 原始方案

`server.py /api/generate` 先执行 `deepseek_generate(profile)`，随后直接：

`save_proposal(agent_id, generated["proposal"], generated["model"])`

客户端 Core 尚未参与。

因此数据库保存的历史方案本身不是 canonical proposal。

**判定：确定结构缺陷。**

建议后续改成：生成 → canonical policy normalize → validate → 持久化 → 前端读取同一 canonical proposal。

### C. Guest 模式完成 IP 后仍可能被当作无 IP

`generateProposal()` 只有 `state.matched` 为 true 时才 `state.proposals.unshift(saved)`。

Guest 生成后虽然可以通过当前消息卡打开 `result.proposal`，但脚本推荐的 `hasIpPlan()` 读取 `state.proposals`，会判定无方案。

**判定：确定回归。**

### D. IP 方案未收口输出

当前 Owner 表覆盖 headline、nickname、bios、主线/支线等，但以下字段仍由 AI 原始 proposal 直接展示：

- `subheadline`
- `tags`
- `clientPortrait`
- `advantages`

它们没有明确唯一 Owner，也没有统一事实约束。

风险：

- 增员路径仍显示“目标客户画像”；
- QS/985/211 反推具体学校可能从 advantages 复发；
- 生活兴趣可能通过 tags/subheadline 获得不恰当的主定位权重；
- 上游旧 Prompt 可以继续通过这些字段影响页面。

**判定：确定治理缺口。**

### E. primaryGoal 没有贯穿 clientPortrait / advantages

最新规则要求后续 IP 方案统一读取标准化 primaryGoal。

当前 Core 会根据 primaryGoal控制 headline、mainline、secondary、bios，但不处理 clientPortrait/advantages；运行时后端 Prompt仍固定以 customerGroups/customerAges 和“目标客户画像”描述。

增员路径因此存在客户语义残留风险。

**判定：确定产品规则漏落地。**

### F. Prompt 双规则源

存在两套：

1. `prompts/ip-persona-prompt.md`：当前规则文档化 Prompt；
2. `server.py::deepseek_generate()`：运行时硬编码 Prompt。

运行时没有读取第一份。

两者当前已经明显漂移：运行时 Prompt仍要求每个平台正好两套简介，而当前产品规则已要求三套。

**判定：确定治理缺口。**

后续应只有一份可执行 Prompt/配置源，文档从它生成或直接引用，不能双维护。

### G. 自然语言资料修改没有覆盖新字段

`deepseek_understand()` allowed_keys 仍不含：

- previousCareer
- lifeRoles
- hobbies
- services
- preferredName
- primaryGoal

前端 `parseRevision()` 也没有覆盖这些关键新字段。

结果：方案完成后说“爱好加骑行”“过往职业改教师”“目标改增员”等，无法可靠写回档案。

**判定：确定回归。**

### H. Preview localStorage 未隔离

V16 profile cache key 固定为 `aia-auto-ip-profile-cache-v1`；app SESSION_KEY 固定为 `aia-auto-ip-session`。

正式站与 `/preview/` 若同 origin，localStorage 不按 path 隔离。

因此：

- Preview 可能 merge 正式站浏览器缓存字段；
- Preview“清空测试”可能同时清掉正式站同 origin 的登录 session；
- 本地状态与服务器 API 的环境隔离不一致。

**判定：确定治理缺口。**

### I. Preview lookup 对正式站有同步依赖

`api-routing-v1.js` lookup 同时发 Preview 与 production 请求；拿到 Preview response 后仍 await production promise 以补 peer review。

生产端慢/异常时，Preview lookup 会被一起拖慢；当前没有明确短超时/快速降级。

**判定：确定稳定性风险。**

### J. 退役 content planning 继续影响当前导航

独立内容规划入口虽然由 V12 移除，但 `app.js` 仍保留完整 planningState/contentPlans；`startWorkspace()` 默认 tool 判断：

有 proposal 且有 contentPlan → 默认 script。

旧功能历史数据仍决定当前产品落地页。

**判定：确定 legacy leakage。**

### K. 完成度百分比双 Owner

V8 与 V9 都 wrapper `renderProfile()` 并重算 `#completion`：

- V8：name + agentId + questions；
- V9：只 questions。

后加载层会覆盖前层值。

**判定：确定双 Owner。**

### L. Clipboard 三 Owner

当前存在：

1. `app.js::copyText()`：昵称/简介原始复制；
2. V10 `write()`：第一次昵称/简介合规流程自己写 Clipboard；
3. V28：脚本改写/小红书创作结果复制。

当前 contract test 只检查 V22/V28，漏掉 app.js 和 V10，因此“Clipboard one owner”测试会假绿。

**判定：确定治理缺口 + 测试假保护。**

### M. Loading/状态组件仍未真正公共化

规则要求脚本改写与小红书等待状态由统一状态组件管理。

现实：

- app.js 各自创建不同 loading 消息；
- V22 通过 MutationObserver 对小红书旧文案做后置替换；
- 脚本改写仍使用自己的硬编码 loading 文案。

**判定：确定治理缺口。**

### N. 79 同类性能风险仍在 V17

V17 仍 observe `document.body` subtree + class attributes；任何页面 class 更新都会触发 syncButtons。

79 的稳定性测试只检查 `profile-float.js`，没有扫描所有加载脚本中的全 body observer。

**判定：确定同类风险 + 测试盲区。**

### O. contentTone 题型与文案不一致

V13 文案：可选 1～2 个。

实际 question 未设置 `multiple:true`。

**判定：确定交互回归。**

### P. 昵称无人物锚点时仍放行 AI

nickname-policy 在有 anchor 时受控生成；但无 anchor 时会 fallback 到 AI `proposal.nicknameOptions`，只过滤品牌/保险词。

可能出现无人物主体昵称。

**判定：确定边界漏洞。**

### Q. 内容支线多来源证据被弱化

V14 对 `evidenceStrength` 使用 `Math.max`，而退役 V26曾累计多来源证据。

同一方向来自“家庭身份 + 自我介绍 + 客户反馈”时，当前无法充分体现证据一致性。

**判定：确定排序能力降级。**

### R. 语义提取未感知拓客/增员语义

profile_semantic 对 customerGroups 的定义仍是“希望/主要服务的人群”，没有根据 primaryGoal 区分客户 vs 准增员。

增员目标下，客户服务信息可能错误预填 recruitment audience，并跳过真正应该问的准增员问题。

**判定：确定语义风险。**

### S. 小红书：原文保护正确，但 Emoji 密度仍旧

第三轮确认：

- `preserves_source_text()` 已对模型结果做确定性原文保护；这一条不应再当回归修。
- `add_scan_emojis()` 的确定性规则仍是“每三句话至少一个”，和最新“任何连续两句至少一个”不一致。

**判定：原文保护正确；Emoji 密度确定未达最新规则。**

### T. 客户反馈导入语义正确

`peer_review_import.py` 中 nickname 映射来源确实是问卷第 1 题“你平时怎么称呼TA？”。数据库字段名 `reviewer_nickname` 命名易误解，但数据语义没有反。

**判定：无需产品修复；后续可考虑技术字段重命名但非当前必要。**

### U. Hosted Frontend QA 当前测试集本身过期

`frontend-ci.yml` 执行 `npm run test:e2e` → `playwright test`，会运行全部 E2E。

当前 tests/e2e 中仍存在：

- 要求 V30 最后加载；
- 要求两行文字悬浮按钮；
- 调用已退役接口；

这些已经被最新 baseline supersede。

因此 Hosted Actions 额度恢复后，直接重新跑也不能把“红/绿”当成有效产品结论，必须先清理 E2E 契约。

**判定：确定测试治理问题。**

### V. ECS 本地检查覆盖不足

`check-preview-local.sh` 当前只跑 3 个 pytest 静态/契约文件，不跑浏览器 E2E，也不验证：

- `/preview/api/scripts/library`
- `/preview/api/scripts/recommend`
- `/preview/api/profile/analyze`
- 有 IP / 无 IP真实页面路径
- 上一篇/下一篇点击
- 分页
- 浮层显示/收起

因此“本地必要检查全绿”不能等价为“产品效果完整”。

**判定：确定门禁覆盖不足。**

## 三、第三轮对前两轮结论的修正

1. **小红书原文零改动**：已有 deterministic preservation，保留，不重复修。
2. **客户反馈字段映射**：确认正确；问题在双渲染 Owner，不在 Excel 映射。
3. **今日推荐 / 每板块换一批**：V21 保留，继续视为正确效果。
4. **脚本详情上一篇/下一篇**：UI 仍在，但接口断链，维持“确定回归”。
5. **QS具体学校**：昵称/简介部分保护正确，但保护范围不足，需扩展到整个 proposal。

## 四、第三轮后“确定要修、不需要产品重新确认”的范围

以下均已有最新规则依据，可直接进入修复设计：

- canonical proposal 必须在持久化/进入 state 前生成，而不是 render 时临时修改；
- guest proposal 进入当前会话 state；
- primaryGoal 贯穿 clientPortrait/advantages 等完整方案；
- 明确 subheadline/tags/clientPortrait/advantages Owner；
- Prompt 单一规则源；
- 扩展资料修改字段；
- Preview localStorage/session namespace 隔离；
- Preview lookup生产补充设置短超时/可降级；
- 退役 planning 不再影响当前导航；
- completion 收单 Owner；
- Clipboard 收公共 Owner；
- Loading/Empty/Error 收公共 Owner；
- 全 body observer 扫描扩展到所有加载 JS；
- contentTone 支持真正 1～2 多选；
- 昵称无人物 anchor 时不得放行 AI；
- 昵称受控模板补全；
- 内容支线未知方向/目标权重/多来源证据累计补全；
- semantic extraction goal-aware；
- 全 proposal 事实约束；
- 无 IP 脚本库分页 + 响应式两列；
- V17 接口迁移；
- 个人介绍 semantic API 接回当前资料 Owner；
- 增员 audience question/方案语义迁移；
- 简介完整受控生成引擎；
- 小红书 Emoji 密度与孤立标点规则；
- 过期 E2E 重写；
- ECS smoke 增强。

## 五、仍需 Preview/浏览器动态验证、静态审计无法证明的范围

这些不是“需要产品重新决定”，只是必须在统一 Preview 后真实跑：

- 浮窗在 IP 对话页真实出现、拖动、关闭、返回恢复；
- 移动端软键盘/焦点/Enter；
- 长资料与客户反馈滚动；
- 合规弹窗尺寸和标题同行布局；
- 真脚本数据库的有 IP 推荐是否命中；
- 无 IP 全库分页能否遍历 total；
- 上一篇/下一篇连续浏览；
- 脚本改写/小红书真实 Clipboard；
- Preview刷新历史恢复；
- 大量历史消息情况下的性能。

## 六、第三轮结论

第三轮仍发现了多项第一、二轮未覆盖的问题，因此在当前代码未做系统修复前，不能声称“所有回归均已消除”。

但到本轮结束后，系统性问题类别已经基本收敛到：

1. canonical data 生命周期；
2. Owner 不完整/重复；
3. Prompt/规则源漂移；
4. legacy leakage；
5. Preview环境隔离；
6. 公共 UI组件未真正公共化；
7. 测试假保护与动态路径缺失。

下一步不应继续增加第四轮同类型静态抽查，而应先按以上七类做结构修复，再用统一 Preview + 动态浏览器验收发现剩余运行时问题。