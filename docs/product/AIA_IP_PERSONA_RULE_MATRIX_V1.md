# AIA IP Persona Rule Coverage Matrix V1

> 状态：DRAFT / 增量维护。  
> 目标：每条历史/新增规则明确 `source → status → PRD Rule ID`。禁止以重新总结 PRD 代替逐条映射。

## 状态定义

- `ACTIVE`：当前有效，必须映射 PRD Rule ID。
- `SUPERSEDED`：已被更新规则明确替代。
- `DUPLICATE`：语义重复，由另一 ACTIVE Rule ID 承载。
- `CONFLICT`：暂无法依据时间/明确确认消解；冻结前必须为0。

## 已确认增量映射（2026-09-08）

| 来源/规则 | 状态 | PRD Rule ID | 说明 |
|---|---|---|---|
| 20260903 Ledger：自媒体运营经验退出人设资产池 | ACTIVE | DATA-003 | 媒体职业事实例外，运营成绩仍排除 |
| 20260903 Ledger：事实证据/资产竞争 | ACTIVE | EVID-001~006 | 含<5年门禁、内部黑话 |
| 20260903 Ledger：稳定稿增量补充 | ACTIVE | STABLE-001~005 | 资料不足不凑内容 |
| nickname-source-ranking P-1 approved preset | ACTIVE | NICK-005 | primary固定首选；AI不能写approved；fallback保留 |
| nickname-source-ranking：真实称呼来源/同频排序 | ACTIVE | NICK-003~004 | 禁止无证据造小名 |
| nickname naturalness #104 单字截名禁令 | ACTIVE | NICK-003 | 已合并 |
| #105 完整人物事实源 | ACTIVE | DATA-002 | 已独立固化 |
| #106 中文口语自然度 | ACTIVE | NICK-010 | 硬门禁 |
| #107 万能模板降级/宁缺毋滥 | ACTIVE | NICK-010~011 | 已固化 |
| #108 过往职业退出新昵称 | ACTIVE | NICK-007 | 已固化 |
| #109 纯称呼/姓名最多2个 | ACTIVE | NICK-011 | 已固化 |
| #111 首选不默认本名 | ACTIVE | NICK-012 | 已固化 |
| #112 鲜明修饰语可优先 | ACTIVE | NICK-008/NICK-012 | 普通靠谱专业真诚不得机械套用 |
| #113 中文可记忆可搜索 | ACTIVE | NICK-009 | 全英文降级 |
| #114 陌生人记忆点优先 | ACTIVE | NICK-006/NICK-012~014 | 含已有好昵称保护 |
| Nickname Memory Score | ACTIVE | NICK-013~014 | 完整分值和tie-break已固化 |
| 原昵称保留判断 | ACTIVE | NICK-015 | 三态+固定理由 |
| 当前产品昵称品牌/行业词策略 | ACTIVE | NICK-016 | 产品主动更严格 |
| 简介：A/B/C/D证据等级 | ACTIVE | EVID-001 | D原则禁入最终事实 |
| 简介：模糊字段不得升级经历 | ACTIVE | EVID-002 | 已固化 |
| 简介：时间精度 | ACTIVE | EVID-003 | 已固化 |
| 简介：素材优先级 | ACTIVE | BIO-002 | 已固化 |
| 简介：跨行语义去重 | ACTIVE | BIO-003 | 已固化 |
| 简介：客户评价只写结论 | ACTIVE | BIO-004 | 禁系统解释前缀 |
| 简介：兴趣不机械限1–2 | ACTIVE | BIO-005 | 已固化 |
| 简介：服务不机械限3–4 | ACTIVE | BIO-006 | 叠加20260908每项≤6字 |
| 简介：每平台不再3候选 | ACTIVE | BIO-007 | XHS 1套；视频/抖音1套 |
| 简介：正文默认≥3行 | ACTIVE | BIO-008 | 资料不足例外 |
| 简介：单行12–20优先/25绝对上限 | ACTIVE | BIO-009~010 | 已固化 |
| 简介：同一语义维度/短资产合并 | ACTIVE | BIO-010~011 | 已固化 |
| 简介：行长均衡 | ACTIVE | BIO-012 | 已固化 |
| 简介：Emoji不重复/淘汰👤 | ACTIVE | BIO-013 | 已固化 |
| 20260908：服务项≤6字 | ACTIVE | BIO-006 | 最新确认覆盖旧“≤4字” |
| 20260908：三平台完整简介≤100 | ACTIVE | BIO-015 | 含正文+headline+固定尾部 |
| canonical headline 单一来源 | ACTIVE | HEAD-007/BIO-014 | 不允许Bio另造slogan |
| XHS固定声明 | ACTIVE | COMP-004 | 逐字固定、最后一句 |
| 视频/抖音固定三行 | ACTIVE | COMP-005 | 顺序连续固定 |
| agentId≠执业证编号 | ACTIVE | COMP-006 | 禁止冒充 |
| Preview 000占位可正式输出 | SUPERSEDED | COMP-007 | 正式推荐/复制/稳定稿/Production禁止000 |
| 敏感行业词全部归因为XHS官方普遍禁词 | SUPERSEDED | COMP-002 | 产品门禁保留；来源改为P/C/A分层 |
| 20260908 Compliance P/C/A来源矩阵 | ACTIVE | COMP-001~009 | 不降低门禁，只纠正归因 |
| 20260908 mature UI preserve | ACTIVE | UI-001~010 | Engine重构不等于重做页面 |
| 159 脚本详情重复上一篇/下一篇 | ACTIVE | UI-009 | 正文底部唯一一组；底栏仅两工具 |
| “就按这个改”新proposal版本 | ACTIVE | UI-005 | 历史不可变 |
| 明确事实修改后重算受影响输出 | ACTIVE | UI-005 | 已固化 |
| 用户修改不能绕过事实/合规 | ACTIVE | UI-006 | 已固化 |
| 内容方向/脚本推荐保留 | ACTIVE | UI-008 | 已固化 |
| 新Engine单一链路 | ACTIVE | ENG-001~005 | AI仅受控语言候选 |
| 唯一Writer/Owner | ACTIVE | ENG-003~004 | 防止旧Vxx重新获得写权 |

## 已明确 SUPERSEDED 的历史方向

以下历史方向不得重新进入 ACTIVE：

- 同一平台固定生成3套 Bio 候选；
- 兴趣最多1–2个；
- 服务最多3–4个；
- 荣誉最多1–2个；
- “简介越短越好”；
- 25字作为普通目标（当前为绝对上限）；
- 每行相同 Emoji / `👤`；
- “多人反馈/客户高频评价”等证据来源前缀进入最终简介；
- 模糊关键词升级成职业/经历；
- headline 与 Bio slogan 分别生成；
- headline 使用 `｜` 标签墙；
- 强制把保险业务价值塞进 headline；
- 过往职业作为新昵称；
- 裸姓名默认首选；
- 多个真实称呼用于凑满5个候选；
- 全英文默认首选；
- 新昵称使用装饰符号/Emoji/无意义数字；
- 万能尾缀批量默认；
- 无人物锚点的纯定位昵称作为正常默认；
- Preview `000` 占位进入正式推荐/复制/稳定输出。

## 待继续增量审计

1. 将历史 246 项 Inventory 的每个编号逐条映射到本 Matrix，而不是只按主题映射。
2. 继续核对 20260825 Ledger 未完整展开的资料收集、目标、页面交互边缘规则，区分哪些属于本 PRD scope。
3. 继续核对受控昵称词库/模板中的“六种命名方法、连接词偏好”等细则并映射稳定 Rule ID。
4. 核对合规修改次数提醒是否属于本次 IP 生成 PRD 的 Interaction scope；若保留，必须注明其时效性和来源等级。
5. 核对现有 tests/Owner 与 PRD 的实现差异；实现差异只记录，不反向覆盖产品规则。

## 当前统计口径

- 已完成：已确认规则的持久化 + 第一批增量映射。
- 历史 Inventory 总量：此前审计口径为 246 项，但本文件尚未获得/重建逐编号完整清单，因此**暂不声称246项已逐条闭环**。
- `ACTIVE 未映射`：**尚未归零，精确数量待逐编号审计完成后给出**。
- `CONFLICT`：当前已识别的“000正式输出”和“敏感词平台归因”均已依据最新确认消解；仍需继续审计是否存在其他历史冲突。
- 冻结状态：**NO / DRAFT**。
