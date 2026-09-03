# OpenSpec in AIA Auto IP

本目录用于把产品修改从“聊天中的需求”转成可追踪、可测试、可归档的工程变更。

每个 change 建议包含：

- `spec.md`：业务事实、验收标准、禁止行为。
- `design.md`：Owner、数据流、接口/数据库影响、兼容策略、测试策略。
- `tasks.md`：实现顺序、自动测试、Preview、业务验收、Archive。

状态流转：

`Explore → Spec → Design → Tasks → Implement → Automated QA → Preview → Business Acceptance → Archive → Freeze RC → Production`

禁止在没有 Spec 的情况下对重复出现的产品规则问题继续叠补丁。
