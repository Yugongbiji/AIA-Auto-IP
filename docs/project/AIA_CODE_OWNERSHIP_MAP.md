# AIA Code Ownership Map

> Phase 2: Owner 收敛和代码链治理。
>
> 目标：建立“唯一业务写入 Owner”，禁止通过新增脚本覆盖旧逻辑。

## 当前运行入口

真实前端入口：`web/index.html`

当前加载链：

```
api-routing-v1.js
app.js
release-planning-goal-v1.js
onboarding.js
product-rules-v5 ~ v29（历史规则集合）
script-recommendation-v1.js
profile-float.js
interaction-v2.js
composer-submit-v2.js
nickname-policy-v1.js
ip-policy-core.js
script-recommendation-navigation-fix.js
ip-onboarding-contract-v1.js
ip-runtime-contract-v1.js
```

## 当前目标架构

```
用户输入
  ↓
Profile Schema / Question Contract
  ↓
唯一 Owner
  ↓
Canonical Output
  ↓
Render Layer
```

## Owner 映射

|能力|唯一 Owner|其他层权限|
|-|-|-|
|IP方案生成|ip-policy-core.js|禁止二次生成|
|一句话IP|ip-policy-core.js|禁止拼接覆盖|
|推荐昵称|nickname-policy-v1.js|禁止历史规则修改|
|简介正文|ip-policy-core.js|禁止追加替换|
|合规尾部|ip-policy-core.js|禁止多处输出|
|问卷字段完整性|product-rules-v13.js / schema contract|禁止跳题和自动填充|
|客户反馈展示|product-rules-v27.js|禁止AI推断|
|内容方向展示|product-rules-v20.js|禁止重新计算|
|脚本推荐|script-recommendation-v1.js|禁止UI层生成|
|脚本改写风格|backend/script_persona_rules.py + 对应前端入口|禁止IP规则污染|
|小红书排版|backend/xhs formatting contract|禁止改事实|
|复制反馈|product-rules-v28.js|禁止重复实现 clipboard|
|Loading/Toast|product-rules-v22.js|禁止各模块自建|

## 历史层处理原则

### 保留但降权

- product-rules-v5/v6/v9/v10/v13/v16/v19/v20/v21/v22/v24/v25/v27/v28/v29

用途：兼容、展示、交互。

### 禁止继续新增业务写权限

任何新增需求必须：

1. 查 Owner。
2. 修改唯一 Owner。
3. 增加 Contract Test。
4. 检查 index.html 加载链。

## Phase 2 后续动作

1. 标记重复写入点。
2. 收回旧脚本业务写权限。
3. 缩短 index.html 加载链。
4. 补充 runtime ownership tests。
5. 通过 Release Gate 后进入下一次 Preview。
