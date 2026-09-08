# AIA IP Persona Rule Coverage Matrix V1

> 状态：**DRAFT / 第二轮反向审计已完成，待历史246项逐编号机械闭环**  
> 目标：每条历史/新增规则明确 `source → status → PRD Rule ID`。禁止以重新总结 PRD 代替逐条映射。

## 状态定义
- `ACTIVE`：当前有效，必须映射 PRD Rule ID。
- `SUPERSEDED`：已被更新规则明确替代。
- `DUPLICATE`：语义重复，由另一 ACTIVE Rule ID 承载。
- `CONFLICT`：无法依据时间/明确确认消解；冻结前必须为0。

## A. 数据 / Onboarding / 证据

| 来源/规则 | 状态 | PRD Rule ID | 说明 |
|---|---|---|---|
| 20260903 Ledger：自媒体运营经验退出人设资产池 | ACTIVE | DATA-003 | 媒体职业事实例外，运营成绩仍排除 |
| 20260825 Ledger / onboarding：primaryGoal 只拓客/增员 | ACTIVE | DATA-004 | 模糊目标重新二选一，后续同源 |
| onboarding：首次进入完整链路 | ACTIVE | DATA-009~010 | 合并已有资料→目标→第一个缺失题 |
| onboarding：selfIntro 语义提取只补缺失 | ACTIVE | DATA-011 | 个人介绍最后整行展示 |
| onboarding：agentId 9位，仅匹配资料 | ACTIVE | DATA-012 | 绝不能当执业证编号 |
| onboarding：拓客/增员目标人群分支 | ACTIVE | DATA-013 | 增员年龄无55+ |
| onboarding：资料字段清单/contentTone/多选 | ACTIVE | DATA-014 | 学历含大专；contentTone 1–2 |
| onboarding：快捷项无逃逸/统一Composer | ACTIVE | DATA-015 | Send唯一提交；标签不拉键盘 |
| onboarding：历史用户恢复 | ACTIVE | DATA-016 | 资料足够不制造提问 |
| Ledger：生成后可修改事实字段 | ACTIVE | DATA-017 | 先写事实层再重算受影响输出 |
| stable baseline：agents/saved_profiles/messages/proposals/current_ip_outputs分层 | ACTIVE | DATA-018 | conversation_messages保留追溯原文 |
| peer review：一人多评价原始明细+聚合 | ACTIVE | DATA-019 | agentId主键；原始评价保留 |
| peer review：summary/keywords不覆盖本人事实字段 | ACTIVE | DATA-020 | 未匹配编号报告，不静默建人 |
| A/B/C/D证据等级 | ACTIVE | EVID-001 | D原则禁入最终事实 |
| 模糊字段不得升级经历/能力 | ACTIVE | EVID-002 | 已固化 |
| 时间/数字精度 | ACTIVE | EVID-003 | 7年+不得降为多年 |
| 人物资产竞争 | ACTIVE | EVID-004 | 强事实优先弱形容词 |
| 当前行业<5年默认不做卖点 | ACTIVE | EVID-005 | ≥5年参与竞争非必选 |
| 内部黑话退出 | ACTIVE | EVID-006 | MDRT/COT/TOT等真实荣誉例外竞争 |
| 多来源合并/冲突事实不让AI选 | ACTIVE | EVID-007 | 已固化 |
| nickname/headline/bio共用事实资产体系 | ACTIVE | EVID-008 | 禁按字段顺序拼接 |
| 类别信息不得反推具体事实 | ACTIVE | EVID-009 | QS/985/海归/宝妈/MDRT等 |

## B. 稳定稿 / 历史版本 / 数据保护

| 来源/规则 | 状态 | PRD Rule ID | 说明 |
|---|---|---|---|
| current_ip_outputs 为正式稳定输出 | ACTIVE | STABLE-001 | 当前认可版本 |
| 有稳定稿不因刷新/登录/模型变化重生成 | ACTIVE | STABLE-002 | 稳定稿优先 |
| proposals 历史不可覆盖 | ACTIVE | STABLE-003 | 修改产生新版本 |
| saved_profiles 只存人物事实 | ACTIVE | STABLE-004 | 不存最好文案 |
| 新资料不得直接覆盖 stable | ACTIVE | STABLE-005 | 完整增量链路 |
| 只有明显更好才能 promote | ACTIVE | STABLE-006 | 仅换措辞不升级 |
| 事实/质量/自然度/合规退化保持旧稿 | ACTIVE | STABLE-007 | 已固化 |
| stable 允许修改的四类条件 | ACTIVE | STABLE-008 | 事实错/规则错/更强资产/用户明确修改 |
| 资料不足稳定稿后续增量优化 | ACTIVE | STABLE-009 | 不推倒重来 |
| 增量后重新过全部门禁 | ACTIVE | STABLE-010~011 | 不凑内容 |
| 上游 facts/evidence 防绕过 | ACTIVE | STABLE-012 | UI/Prompt/fallback不能直写最终字段 |
| 下游只读 canonical output | ACTIVE | STABLE-013 | 内容/脚本不重算人设 |
| stable/proposal分层 | ACTIVE | STABLE-014 | promote才更新stable |
| 所有旧proposal永久保留/可回滚 | ACTIVE | STABLE-015 | 已补齐 |
| stable晋级硬门禁 | ACTIVE | STABLE-016~017 | 三维完整、canonical、合规、去重、低价值过滤 |
| 真实个人资料不提交GitHub | ACTIVE | STABLE-018 | 隐私/仓库边界 |

## C. 推荐昵称

| 来源/规则 | 状态 | PRD Rule ID | 说明 |
|---|---|---|---|
| approved nicknamePreset primary最高优先 | ACTIVE | NICK-005 | AI不能写approved/不能顶掉primary |
| 人物锚点来源与同频排序 | ACTIVE | NICK-003~004 | 禁无证据小名/单字截名 |
| #106中文口语自然度 | ACTIVE | NICK-010 | 硬门禁 |
| #107万能模板降级/宁缺毋滥 | ACTIVE | NICK-010~011 | 已固化 |
| #108过往职业退出新昵称 | ACTIVE | NICK-007 | 已固化 |
| #109纯称呼/姓名最多2个 | ACTIVE | NICK-011 | 已固化 |
| #111首选不默认本名 | ACTIVE | NICK-012 | 已固化 |
| #112鲜明修饰语可优先 | ACTIVE | NICK-008/NICK-012 | 普通靠谱专业真诚不得机械套用 |
| #113中文可记忆可搜索 | ACTIVE | NICK-009 | 全英文降级 |
| #114陌生人记忆点优先 | ACTIVE | NICK-006/NICK-012~015 | 含已有好昵称保护 |
| Nickname Memory Score | ACTIVE | NICK-014~015 | 完整分值和tie-break |
| 原昵称三态判断 | ACTIVE | NICK-016 | 固定可解释理由 |
| 无/暂无/没有/0/未设置缺失值 | ACTIVE | NICK-017 | 不得作为昵称资产 |
| 六种受控命名路线 | ACTIVE | NICK-018~019 | 身份/性格/地域/当前专业/学历/成就 |
| 受控连接词 | ACTIVE | NICK-020 | 说/聊/讲优先于谈/看 |
| 昵称完整生成顺序 | ACTIVE | NICK-021~022 | AI仅最后受控兜底 |
| 品牌/保险词产品策略 | ACTIVE | NICK-023~024 | 唯一识别号同样禁止品牌变体 |
| 昵称无冻结数字字符上限 | ACTIVE | NICK-025 | 不得凭空补数字 |
| approved primary→backups→规则→AI顺序 | ACTIVE | NICK-026 | FINAL_OUTPUT_RULE_AUDIT找回 |
| 至少保留一个稳妥人物锚点备选 | ACTIVE | NICK-027 | 无锚点则提示不足，不退化标签昵称 |
| 跨平台原昵称渐进统一/问题1-2-3解释 | ACTIVE | NICK-028 | 不强制立即修改 |
| preset/原昵称进入推荐前形式标准化 | ACTIVE | NICK-029 | 去Emoji/装饰字符等 |
| 推荐理由不暴露内部人工/排序/fallback | ACTIVE | NICK-030 | 只解释用户价值 |
| 过往职业作为新昵称路线 | SUPERSEDED | NICK-007 | 后续#108明确废止 |
| 裸姓名默认首选 | SUPERSEDED | NICK-012 | 有真实记忆点时降为备选 |
| 全英文默认首选 | SUPERSEDED | NICK-009 | 中文可记忆可搜索优先 |

## D. 一句话 IP / Headline

| 来源/规则 | 状态 | PRD Rule ID | 说明 |
|---|---|---|---|
| slogan目的/2–3最强点 | ACTIVE | HEAD-001~002 | 非标签墙/非业务说明 |
| 强资产排序/<5年/运营数据/黑话退出 | ACTIVE | HEAD-003 | 已固化 |
| 数字精度/无证据禁词 | ACTIVE | HEAD-004 | 已固化 |
| 无人物名/禁竖线/自然中文标点 | ACTIVE | HEAD-005 | 已固化 |
| #119机械句式禁止 | ACTIVE | HEAD-006~007 | AI和fallback都适用 |
| proposal.headline canonical唯一同源 | ACTIVE | HEAD-008~009 | 三处逐字一致 |
| headline无冻结数字上限 | ACTIVE | HEAD-010 | 受简介≤100约束 |
| headline完整候选资产来源 | ACTIVE | HEAD-011 | A/B/C事实先竞争 |
| primaryGoal只改变真实资产排序 | ACTIVE | HEAD-012 | 不强制业务词 |
| fallback不得按固定字段机械拼 | ACTIVE | HEAD-013 | 同一事实池/门禁 |
| headline与Bio slogan分别生成 | SUPERSEDED | HEAD-008 | canonical唯一来源 |

## E. 推荐简介

| 来源/规则 | 状态 | PRD Rule ID | 说明 |
|---|---|---|---|
| 三个核心问题/1–3行/非履历非口播 | ACTIVE | BIO-001 | 已固化 |
| 素材优先级 | ACTIVE | BIO-002 | 已固化 |
| 家庭/职业/学历/荣誉真实性 | ACTIVE | BIO-003 | 已固化 |
| 取消机械减法 | ACTIVE | BIO-004 | 兴趣/荣誉/服务不设旧数量上限 |
| 跨行语义去重 | ACTIVE | BIO-005 | 强事实优先 |
| 客户评价只呈现结论 | ACTIVE | BIO-006 | 禁来源前缀 |
| 服务真实、每项≤6字、｜分隔 | ACTIVE | BIO-007 | 最新规则覆盖旧≤4 |
| XHS 1套 + 视频/抖音1套 | ACTIVE | BIO-008 | 旧每平台3方案废止 |
| 正文→headline→固定尾部 | ACTIVE | BIO-009 | 固定结构 |
| 正文默认≥3行/资料不足例外 | ACTIVE | BIO-010 | 不为凑行编造 |
| 12–20优先/21–25例外/25绝对上限 | ACTIVE | BIO-011~012 | 已固化 |
| 单行同维度/短资产合并 | ACTIVE | BIO-013 | 已固化 |
| 行长均衡 | ACTIVE | BIO-014 | 已固化 |
| Emoji语义匹配/不重复/淘汰👤 | ACTIVE | BIO-015 | headline/footer不参与 |
| canonical headline原样复用 | ACTIVE | BIO-016 | 不二次改写 |
| 三平台完整简介≤100 | ACTIVE | BIO-017 | 正文+headline+固定尾部 |
| 本人strengths/traits与反馈来源隔离 | ACTIVE | BIO-018 | FINAL_OUTPUT_RULE_AUDIT找回 |
| content branch不得反向变hobby | ACTIVE | BIO-019 | 兴趣必须直接有证据 |
| 资料丰富时不把全部优势压一行 | ACTIVE | BIO-020 | 多个合格信息行优先 |
| 服务单项≤4字 | SUPERSEDED | BIO-007 | 用户最新明确≤6字 |
| 兴趣≤1–2/服务≤3–4/荣誉≤1–2 | SUPERSEDED | BIO-004 | 取消机械数量上限 |

## F. 合规 / AI / Interaction

| 来源/规则 | 状态 | PRD Rule ID | 说明 |
|---|---|---|---|
| P/C/A合规来源分层 | ACTIVE | COMP-001~011 | 不把内部策略冒充平台官方 |
| XHS固定声明 | ACTIVE | COMP-004 | 逐字固定/最后一句 |
| 视频/抖音固定三行 | ACTIVE | COMP-005~006 | 顺序连续/不参加正文行宽门禁 |
| agentId≠执业证编号 | ACTIVE | COMP-007 | 禁止冒充 |
| Preview 000进入正式输出 | SUPERSEDED | COMP-008 | 正式推荐/复制/stable/Production禁止 |
| AI权限边界 | ACTIVE | AI-001~004 | 只做受控语言候选 |
| mature UI preserve | ACTIVE | UI-001~003/UI-011 | Engine重构不重做页面 |
| 首次复制分别一次提醒 | ACTIVE | UI-004/UI-017~018 | 两栏合规窗/统一Clipboard |
| AI推荐昵称提醒 | ACTIVE | UI-005 | 固定短提醒 |
| 就按这个改→新proposal | ACTIVE | UI-006 | 历史不可覆盖 |
| 用户修改不能绕过事实/合规 | ACTIVE | UI-007 | 已固化 |
| 稳定稿刷新不随机换稿 | ACTIVE | UI-008 | 已固化 |
| 脚本详情唯一上一篇/下一篇 | ACTIVE | UI-010 | 底栏仅两工具 |
| 历史用户资料/方案复用 | ACTIVE | UI-012 | 已固化 |
| 无IP脚本库响应式/跳转 | ACTIVE | UI-013 | 进一步由SCRIPT-003细化 |
| 纯图标资料/IP方案悬浮入口 | ACTIVE | UI-014 | 精确页面可见性/真实页面状态 |
| 我的资料/客户反馈成熟展示 | ACTIVE | UI-015 | 个人介绍最后、反馈独立/聚合/折叠 |
| 原昵称板块位置/问题解释 | ACTIVE | UI-016 | 已固化 |

## G. 内容方向 / 脚本推荐下游保护

| 来源/规则 | 状态 | PRD Rule ID | 说明 |
|---|---|---|---|
| “主线+1条内容支线” | ACTIVE | CONTENT-001 | 最终只展示一个最优支线 |
| 拓客主线边界 | ACTIVE | CONTENT-002 | 纯增员内容不得进拓客主线 |
| 增员主线边界 | ACTIVE | CONTENT-003 | 纯保险产品内容不得进增员主线 |
| 内容支线≠保险/增员主线 | ACTIVE | CONTENT-004 | 健康/育儿/养老/职场等边界 |
| 支线不得first-match | ACTIVE | CONTENT-005 | 统一竞争 |
| 支线六维评分与权重 | ACTIVE | CONTENT-006 | 30/20/15/15/15/5 |
| 未知支线统一评分/不强造 | ACTIVE | CONTENT-007 | AI一次推断不沉淀为事实 |
| IP/脚本读取同一canonical方向 | ACTIVE | CONTENT-008 | 旧purpose/旧规划/标签不能覆盖 |
| 内容方向成熟展示 | ACTIVE | CONTENT-009 | 合集/作用/来源/聚焦/脚本入口 |
| 有IP两个推荐板块/去重 | ACTIVE | SCRIPT-001 | 主线在前/不跨无关脚本 |
| 换一批/不足禁用/今日推荐 | ACTIVE | SCRIPT-002 | 用户本地日期 |
| 无IP一级→二级+真实分页+全脚本可达 | ACTIVE | SCRIPT-003 | PC/Pad两列，手机一列 |
| 脚本标签仅内部匹配 | ACTIVE | SCRIPT-004 | 正文内容优先标签名 |
| raw purpose直接决定内容策略 | SUPERSEDED | DATA-004/CONTENT-008 | 统一primaryGoal |
| 双专业主线 | SUPERSEDED | CONTENT-002~003 | 无第三种双主线状态 |

## H. Engine / Owner / Contract

| 来源/规则 | 状态 | PRD Rule ID | 说明 |
|---|---|---|---|
| 新Engine单一链路 | ACTIVE | ENG-001 | 已固化 |
| nickname/headline/bio/footer唯一Writer | ACTIVE | ENG-002 | Prompt不是Owner |
| 历史Vxx只兼容/UI | ACTIVE | ENG-003 | 不写最终字段 |
| 禁MutationObserver/DOM二次改业务结果 | ACTIVE | ENG-004 | 已固化 |
| 禁继续V34/V35/V36 patch叠加 | ACTIVE | ENG-005 | 进入唯一Engine |
| 新Engine先独立Contract再切页面 | ACTIVE | ENG-006 | 防回归 |
| 统一生成顺序 | ACTIVE | ENG-007 | stable→facts→evidence→assets→generate→budget→compliance |
| 上下游单向数据契约 | ACTIVE | ENG-008~010 | 展示Owner不等于Writer |
| Contract覆盖 | ACTIVE | ACC-001~010 | 含Onboarding/评价/内容/脚本/UI |

## I. 明确 SUPERSEDED 汇总

不得恢复：同平台固定3套Bio；固定只选3–5人物资产；兴趣1–2、服务3–4、荣誉1–2机械上限；服务单项≤4字；越短越好；25作为普通目标；相同Emoji/👤；客户反馈来源前缀；模糊字段升级；headline/Bio slogan分离；headline竖线标签墙；强制保险业务价值；过往职业新昵称；裸姓名默认首选；多个称呼凑5个；全英文默认首选；装饰符号/数字尾缀；万能尾缀批量默认；无人物锚点纯定位昵称；raw purpose直接真源；双主线；快捷跳过逃逸项；历史内容规划覆盖当前IP；旧折叠合规大板块/返回检查；正式000；历史Writer/Prompt/MutationObserver/DOM patch最终写权。

## J. 当前审计结论

- 第二轮反向审计已将当前仓库中**已识别、仍有效、且属于“人设生成及其上游/下游保护”范围**的规则补入 `AIA_IP_PERSONA_PRD_V1.md` 并建立本 Matrix 映射。
- 已反向核对的主要规则源：20260824 Baseline、20260825 Ledger、20260903 Ledger、FINAL_OUTPUT_RULE_AUDIT、STABLE baseline、ip-onboarding、ip-output、ip-headline、nickname source/naturalness、昵称/简介受控词库、peer-review、content-goal-boundary、content-branch-ranking、compliance 及相关 Owner/Contract 文档。
- 当前已发现的规则冲突均已有明确最新覆盖关系；**本轮没有新增待产品负责人判断的 CONFLICT**。
- 仍不能正式写 `ACTIVE未映射=0`：此前“246项 Inventory”没有作为逐编号完整清单持久化在当前仓库，本轮无法对一个不存在的逐编号母表做机械计数。下一步若要把 PRD 从 DRAFT 升级 FROZEN，需要把历史246项编号母表重建/找回，并执行最终 `246编号 → status → Rule ID` 一一核销。
- 冻结状态：**NO / DRAFT（内容已大幅收口，仅等待最终逐编号证明）**。
