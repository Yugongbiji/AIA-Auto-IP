# AIA Duplicate Writer Audit

> Phase 2：Owner 收敛和代码链治理第一阶段产物。
>
> 目标：识别同一业务结果是否存在多个写入点，避免通过加载顺序和补丁脚本解决冲突。

## 审计范围

重点字段：

- proposal
- nicknameOptions
- bios
- headline
- contentMainline
- secondaryContent
- currentQuestion
- customer feedback display
- script recommendation context

## 当前主要风险

### 1. IP方案输出

唯一 Owner：

`web/ip-policy-core.js`

当前风险：

- AI 原始输出可能绕过 canonical 标准化
- 历史 product-rules 层可能继续修改展示状态

处理原则：

所有最终用户可见 IP 输出必须经过 ip-policy-core。

---

### 2. 昵称

唯一 Owner：

`web/nickname-policy-v1.js`

风险来源：

- product-rules-v19
- product-rules-v27
- product-rules-v29

处理原则：

辅助分析层可以提供信息，但不得重新生成 nicknameOptions。

---

### 3. 简介

唯一 Owner：

`web/ip-policy-core.js`

风险来源：

- 历史规则层追加文本
- 合规层修改正文

处理原则：

简介正文和合规尾部必须分离。

---

### 4. 客户反馈

数据来源必须区分：

- 本人优势
- peer_reviews

禁止：

- strengths 自动包装为多人评价
- AI 推断客户反馈

---

### 5. 问询状态

唯一 Owner：

问卷 Schema / question engine

风险：

- 多个脚本修改 currentQuestion
- 异步保存影响下一题

处理原则：

问题完整性由 Schema 决定，不由页面脚本临时判断。

---

## 处理原则

1. 先收回重复写权限，再修改业务逻辑。
2. 不通过增加新版本 JS 覆盖旧版本。
3. 不依赖 script loading 顺序保证正确性。
4. 每个 Owner 修改必须补 Contract Test。
5. 旧规则保留历史，但不得参与最终业务写入。

## 下一步

Phase 2.2：

- 搜索真实代码写入点
- 标记重复 writer
- 建立迁移计划
- 再调整 index.html 加载链
