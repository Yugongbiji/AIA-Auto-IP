# 产品规则 Owner 清单

> 这是 `rules/product-change-governance.md` 的配套强制清单。任何开发者修改核心产品逻辑前必须先查本表；如果需要新增 owner，先更新本表再改代码。

## 当前唯一 Owner

| 产品输出 / 组件 | 唯一 Owner | 允许做什么 | 其他文件禁止做什么 |
|---|---|---|---|
| `primaryGoal` 拓客/增员 | `web/ip-policy-core.js` | 读取报名目的、判断是否需追问、标准化成二选一 | 不得自行重新猜目的、不得恢复“两者都要/个人品牌”作为最终目标 |
| 保险主线 | `web/ip-policy-core.js` | 从保险业务白名单生成 | 生活兴趣不得写入主线；旧 Vxx 不得改写 |
| 内容支线最终结果 | `web/ip-policy-core.js` | 使用 `rankIpContentBranches()` 候选排序后选最终支线 | 排序模块只能提供候选，不得直接写 proposal |
| 内容支线候选/排序 | `web/product-rules-v14.js` | 从过往职业、生活身份、自我介绍、爱好、客户反馈等提取并排序 | 不得直接写 `proposal.secondaryContent` |
| 推荐昵称 | `web/nickname-policy-v1.js` | 受控模板 + 必有且仅有一个称呼 | V19/V27/V29 只能提供称呼资料或审查，不得改 `nicknameOptions` |
| 原昵称审查 | `web/product-rules-v29.js` | 谨慎评价现有昵称、展示理由 | 不得生成推荐昵称 |
| 推荐简介正文 | `web/ip-policy-core.js` | 从真实资料生成三种简介主体 | 旧 Vxx 不得追加/替换简介正文 |
| 简介合规尾部 | `web/ip-policy-core.js` | 固定声明、营销服务部、执业证编号；唯一输出点 | AI、V10、V16 等不得再次追加；营销员编号不得当执业证编号 |
| 复制前合规弹窗 | `web/product-rules-v10.js` | UI 展示“可以说/不可以说”、首次复制流程 | 不得生成/修改简介业务数据 |
| 资料标准化 / 自我介绍提取 | `web/product-rules-v27.js` | 归一报名字段、提取过往职业/身份/爱好、展示个人介绍/客户反馈 | 不得改昵称、简介、内容方向 |
| 悬浮入口 | `web/profile-float.js` + `web/profile-float.css` | 纯图标、显示范围、展开/收起、拖动、打开方案 | 不得重写 `renderProfile` 的业务内容，不得显示版本号/文字标签 |
| 内容方向 UI | `web/product-rules-v20.js` | 读取 core 的 `contentMainline/secondaryContent` 并展示、跳转推荐脚本 | 不得重新推断主线/支线 |
| 推荐脚本数据/去重 | `web/script-recommendation-v1.js` + 后端推荐服务 | 推荐、去重、脚本库浏览 | UI 增强层不得重新生成推荐数据 |
| 推荐脚本“换一批/今日日期/详情清理” | `web/product-rules-v21.js` | 纯展示交互 | 不得改变推荐业务归类 |
| 智能改写表达风格 | `web/product-rules-v11.js` + 改写后端 | 根据账号表达风格做题材适配 | 其他 IP 规则不得把生活标签当脚本风格 |
| 创作结果复制反馈 | `web/product-rules-v28.js` / 公共 Toast | 真实复制成功后反馈 | 不得靠外围观察器假装成功 |
| Preview 清空测试 | `web/product-rules-v25.js` | 仅 Preview 清本地会话 | 正式环境不得展示 |

## 已明确失去业务写权限的旧层

以下文件可以暂时保留为兼容/UI层，但已经明确**失去核心业务写权限**：

- `product-rules-v5.js`：仅直接进入/资料匹配兼容；不得写简介/合规。
- `product-rules-v6.js`：仅对话 emoji；不得写昵称/简介。
- `product-rules-v9.js`：报名 purpose 只展示；不得创建最终业务目标。
- `product-rules-v10.js`：仅合规提醒 UI；不得写 `proposal.bios`。
- `product-rules-v12.js`：仅撤销旧内容规划入口；不得生成内容策略。
- `product-rules-v13.js`：仅保留仍有效的提问文案；不得生成主线/简介。
- `product-rules-v16.js`：仅资料缓存；不得整理/追加简介合规尾部。
- `product-rules-v19.js`：仅提供优先称呼辅助；不得改推荐昵称。
- `product-rules-v24.js`：仅术语/欢迎文案；不得改业务目标。
- `product-rules-v27.js`：仅资料标准化和资料展示；不得改昵称/悬浮入口/方案。
- `product-rules-v29.js`：仅客户反馈展示和原昵称审查；不得改推荐昵称。

## 已停止加载的重复层

以下文件仍可保留在 Git 历史中，但当前页面不得加载：

- `product-integration-v30.js`
- `product-integration-v31.js`
- `product-integration-v33.js`
- `product-rules-v15.js`（旧客户反馈摘要，已被结构化反馈替代）
- `product-rules-v23.js`（旧折叠客户反馈，已被结构化反馈替代）
- `product-rules-v26.js`（重复内容支线证据池，已合并到 V14 + core）

## 修改流程硬门禁

每次修改核心产品功能前必须依次完成：

1. 查 `CURRENT_PRODUCT_RULES_BASELINE` 判断当前有效需求，不能从旧聊天/旧代码反推产品规则。
2. 查本 Owner 清单确认唯一 owner。
3. 搜索仓库中同一字段/函数是否还有第二写入点。
4. 如果有：先收回旧写权限，再开始新修改。
5. 修改同时补 contract/regression test。
6. Preview 前检查 `index.html` 实际加载链，确认 `SUPERSEDED` 文件没有重新出现。
7. 只有 owner 契约测试 + 影响范围回归通过，才交给产品负责人验收。

**禁止通过“再加一个最后加载脚本”解决冲突。**如果必须依靠加载顺序才能保证业务正确，就视为治理失败，不进入 Preview。
