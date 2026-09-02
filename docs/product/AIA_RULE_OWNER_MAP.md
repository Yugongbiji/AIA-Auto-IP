# AIA Rule Owner Map

## 目的

明确每个业务能力的唯一最终规则 Owner，避免多个历史规则文件互相覆盖。

## Owner 映射

|能力|唯一 Owner|
|-|-|
|昵称生成|nickname-policy|
|一句话 IP|ip-policy-core|
|简介生成|bio-builder|
|IP资料采集|profile-schema|
|客户反馈展示|peer-review-renderer|
|脚本推荐|script-recommendation|
|脚本改写|script-rewrite|
|小红书排版|xhs-builder|
|合规检测|compliance-engine|

## 约束

其他模块可以调用 Owner 输出，但不得：

- 二次生成
- 修改最终结果
- 添加未经规则允许的信息

## 历史规则治理

旧版本规则文件仅作为历史参考。

新的业务修改必须进入 Owner，并同步更新自动测试。
