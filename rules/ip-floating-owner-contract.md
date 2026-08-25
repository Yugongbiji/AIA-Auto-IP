# IP 悬浮入口唯一 Owner 契约

> 发布阻塞 #127 后建立。该契约用于防止“我的 IP 资料 / IP 方案”再次被旧兼容层、旧右侧栏或 overlay 状态误伤。

## 唯一 Owner

- JavaScript：`web/profile-float.js`
- CSS：`web/profile-float.css`
- 资料字段标准化仍由 `web/product-rules-v27.js` 负责；V27 不拥有悬浮入口 DOM。

## 唯一职责

`profile-float.js` 只负责：

1. IP 对话页面显示圆形“我的 IP 资料”入口；
2. 已存在 IP 方案时显示圆形“IP 方案”入口；
3. 创建和维护独立资料抽屉；
4. 点击 IP 方案直接打开 `state.proposals[0]`；
5. 读取 `state.profile` 展示资料，不改写业务资料。

## 可见性真源

悬浮入口只读取最终 DOM：

- `#workspace` 可见；
- `#identity-screen` 已隐藏；
- `#ip-chat-panel` 可见。

禁止再把以下状态作为悬浮入口可见性的必要条件：

- `state.activeTool`；
- `body.proposal-open`；
- 任意旧 proposal/content-plan/detail overlay 是否残留；
- 旧 `.profile-panel` 的 display/class 状态。

## 独立 DOM

悬浮组件必须使用唯一 ID 前缀 `aia-ip-owner-`，不得复用旧 `.profile-panel` 作为抽屉容器。

旧 `.profile-panel` 退出视觉职责；业务代码可以继续维护它用于历史兼容，但不得控制新悬浮入口。

## 资料抽屉结构

按真实资料有则展示、无则隐藏：

1. 基本资料：姓名、营销员编号、所在城市、营销服务部、入职日期、保险从业时间；
2. 经历与优势资料：学历、学校背景、留学背景、明确的过往职业/工作经历、荣誉、长期身份、兴趣爱好、优势、可提供服务；
3. 账号资料：原视频号昵称、原小红书昵称、做自媒体目的、账号运营状态、当前卡点、时间投入；
4. 客户反馈：每个原问题分开；重复项聚合成 `标签 ×N`；
5. 个人介绍：保留原始个人介绍全文，放在最后。

资料窗口不得为了“完整”而猜测或生成不存在的事实。

## 防回归门禁

`tests/test_release_blockers_114_119.py` 必须锁定：

- 不依赖 `state.activeTool`；
- 不依赖 `proposal-open`；
- 不调用旧 `closeStaleOverlaysForIp()`；
- 不查询旧 `.profile-panel` 作为新抽屉；
- `我的 IP 资料` 在 IP 对话页面只由最终 DOM 决定；
- `IP 方案` 只由 `state.proposals` 是否存在决定；
- 五个资料板块与客户反馈聚合规则仍存在。

## 禁止事项

禁止通过新增 Vxx / 最后加载补丁修悬浮入口。若未来要修改该功能，只允许直接修改本 Owner + 对应 contract test。