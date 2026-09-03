# AIA Release Gate

## 目标

定义 AIA 从开发到正式发布的统一验收标准。

## Gate 1 数据安全

必须确认：

- 数据库备份完成
- 用户数据不丢失
- stable baseline 正确
- 数据迁移可回滚

## Gate 2 产品 Contract

必须通过：

- IP 规则
- 一句话 IP
- 简介规则
- 客户反馈真实性
- 问询字段完整性
- 合规规则

## Gate 3 Backend

必须通过：

- API 可用
- 数据读取正常
- 脚本库正常
- 生成链路正常

## Gate 4 E2E 用户旅程

核心流程：

登录 → 资料采集 → IP生成 → IP展示 → 脚本推荐 → 脚本改写 → 小红书排版

## Gate 5 Production Smoke Test

上线后检查：

- 首页
- 登录
- 测试账号
- 稳定数据读取
- 核心功能链路

## 发布流程

开发分支
→ Preview
→ 自动测试
→ 人工验收
→ Freeze Release Candidate
→ 同一版本晋升 Production
→ 发布后检查

禁止：

Preview 验收通过后重新拼装 Production 版本。
