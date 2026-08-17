# AIA-Auto-IP · 智能人设定位工具

友邦人寿（AIA）营销员 IP 人设智能定位工具 —— 方法论、指令 Prompt、合规规则与素材的集中仓库。

> 目标：根据营销员的基本信息 + 客户反馈，自动生成三平台（视频号 / 小红书 / 抖音）统一的昵称与两版合规简介，并给出一句话 IP 概括。

## 目录结构

```
AIA-Auto-IP/
├── README.md                       # 本文件
├── prompts/                        # 指令
│   └── ip-persona-prompt.md        # 完整指令 Prompt（v3，可直接复制给豆包/DeepSeek）
├── rules/                          # 规则（人工可读）
│   ├── compliance-rules.md         # 账号装修合规规则（来自 Excel）
│   └── field-schema.md             # 字段来源与采集规范（A/B/C 三类）
├── src/                            # 可执行代码
│   ├── prompt-engine.js            # Prompt 组装引擎（buildPersonaPrompt）
│   ├── compliance.js               # 合规检测模块（checkNickname/checkBio/checkUniqueId）
│   └── fields-schema.js            # 字段来源 schema（FIELD_SCHEMA / fieldsBySource）
├── assets/                         # 素材（原始资料）
│   ├── IP人设智能工具202608.pdf     # 思路与方法论文档
│   └── 账号装修合规文档.xlsx         # 合规原始规则表
└── docs/
    └── methodology.md              # 五步法 + 六命名策略 + 三段式简介公式
```

## 核心设计

1. **人设优势判断轮**：先评估六维度（身份/性格/地域/专业/学历/成就），只给「值得突出」的维度生成昵称。
2. **学历不暴露短板**：仅名校/硕士+/留学/博士才突出学历维度，普通背景跳过。
3. **昵称纯中文为主**：避免英文/拼音，便于记忆与拼写。
4. **全面合规**：整合《账号装修合规文档》全部规则 + 修改次数提醒（视频号昵称年 5 次 / 小红书简介 7 天 3 次）。
5. **字段来源分层**：问卷(57人) / 后台Excel(年龄·城市) / 建议收集(学历·学校背景·留学·从业时间·荣誉·擅长)，缺失不臆造。

## 使用方式

### 方式一：直接当指令用
复制 `prompts/ip-persona-prompt.md`，把 `【姓名】` 等占位符替换为真实信息，发给豆包 / DeepSeek。

### 方式二：接入网页工具（规划中）
`src/` 下三个 JS 模块可直接被前端调用：
```js
import { buildPersonaPrompt } from './src/prompt-engine.js';
import { checkBio, checkNickname, checkUniqueId } from './src/compliance.js';
import { FIELD_SCHEMA, fieldsBySource } from './src/fields-schema.js';

const prompt = buildPersonaPrompt(userData, feedbackTags);
// 调用 DeepSeek / 豆包 API → 拿到结果 → 用 compliance 模块标红
```

## 数据来源说明
- 问卷字段：已收回 57 人，后台持续补充
- 后台 Excel：姓名/年龄/城市可批量获取
- 建议收集：学历、最高学校背景、留学背景、保险从业时间、荣誉、擅长领域（决定人设深度）

---
*本仓库内容仅供内部方法论沉淀与工具开发，合规要求以公司最新发文为准。*
