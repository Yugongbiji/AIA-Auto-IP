# Design — AIA Stability 152–157

## 核心原则

本 change 不继续新增临时规则补丁层。优先收敛唯一 Owner 与唯一配置源，再修业务行为。

## Owner 与配置源

- 一句话 IP / 推荐简介：继续由 `web/ip-policy-core.js` 唯一写入。
- 推荐昵称：继续由 `web/nickname-policy-v1.js` 唯一写入。
- IP 问卷：建立单一 Question Contract，由 canonical question registry 驱动询问、缺失检测、保存字段映射。
- 城市：建立单一 canonical city list，问卷 UI 只引用，不复制城市数组。
- 客户反馈：服务层必须按当前 `agent_id` 获取，输出层只消费当前 agent 的 evidence object。
- 脚本推荐：明确单一推荐服务入口，前端不得自行复制推荐规则。

## 数据流

IP 资料询问：`profile/survey → field normalization → missing-field detector → question registry → answer persistence → profile refresh`。

`contentTone` 与 `scriptStyleGuide` 必须建立明确映射；空值不得判为已回答。

客户反馈：`peer_reviews(current agent) → normalized evidence → proposal builder`。禁止其他用户评价、默认演示评价或缓存残留进入当前用户上下文。

IP 输出：`normalized profile + scoped evidence → ip-policy-core → proposal.headline / proposal.bios`。兼容/UI 层只能渲染，不能再次改写 headline/bios。

脚本推荐：`current agent/profile/IP state → recommendation service → script_library → ranked scripts → frontend render`。错误态应区分接口失败、空库、无匹配和前端解析失败。

## 测试策略

Contract / Unit：城市列表完整且去重；0 条客户反馈时 evidence 为空；headline 禁止字段墙；素材充分 fixture 的简介人物正文不少于 3 行；缺失问题必问；脚本库非空时推荐服务返回可渲染结果。

API / Integration：使用隔离测试数据验证客户反馈不串号、脚本推荐正常、表达风格保存后可读取。

Playwright：固定测试账号 `宋健 / 111111111`，覆盖登录、IP资料、缺失项询问、表达风格保存、生成 IP、推荐脚本、脚本改写、小红书排版完整旅程。写入型自动化默认运行在隔离 Preview 测试数据上。

## Preview 数据安全

新 Preview 必须与 Production SQLite 分离。Preview 部署不得隐式清理、覆盖或回写 Production 数据；测试数据通过明确 seed fixture 生成。

## 发布策略

`development branch → automated gates → Preview → 用户业务验收 → Archive → Freeze RC → promote same RC → Production smoke`

业务验收不通过时回到同一个 Spec 更新 acceptance/tasks，不创建临时补丁 change。
