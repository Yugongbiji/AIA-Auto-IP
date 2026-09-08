# AIA IP Persona Incremental Rule Audit — 2026-09-08

> 本文件记录审计进度，不是产品规则源。产品规则写入 `AIA_IP_PERSONA_PRD_V1.md`；映射写入 `AIA_IP_PERSONA_RULE_MATRIX_V1.md`。

## 工作原则

1. 已确认规则立即持久化到 PRD，不等待全量审计结束。
2. 后续只增量补 Rule ID，不重新生成整份 PRD。
3. 代码现状/测试现状只能记录实现差异，不能反向定义产品规则。
4. 冻结前必须完成历史 Inventory 逐编号映射，ACTIVE 未映射=0、CONFLICT=0。

## 本轮已固化

- nicknamePreset approved/primary/allowAiFallback 完整逻辑；
- Nickname Memory Score 全分值与 tie-break；
- 原昵称三态判断和人工固定理由保护；
- 真实称呼来源和同频排序；
- 已有好昵称不机械优化；
- 前职业退出新昵称；
- canonical headline 单一来源；
- 事实强度、时间精度、跨行语义去重；
- 简介默认≥3行及资料不足例外；
- 12–20优先、21–25例外、25绝对上限；
- 服务项≤6字、仅真实资料、`｜`分隔；
- 三平台完整简介总长≤100，含 headline 和固定合规尾部；
- P/C/A Compliance Matrix；
- 正式输出禁止用000冒充执业证编号；
- 稳定稿增量更新；
- Interaction Contract；
- Engine唯一Writer与受控AI边界。

## 下一批审计

- 昵称受控词库六种命名方法与连接词偏好；
- 20260825 Ledger 中本 PRD scope 内仍未逐条展开的规则；
- 历史246项 Inventory 逐编号映射；
- 合规修改次数提醒的来源/时效性/是否纳入 Interaction；
- 现有 Owner/tests 与新 PRD 的实现差异登记。

## 安全边界

本轮只创建文档分支，不修改业务代码、数据库、Preview 或 Production。不得把本 Draft 自动发布到 main/Production。
