# Runtime Canonicalization Migration Plan

## Purpose

将 stable runtime 从 legacy core module monkey patch 模式逐步迁移为 canonical runtime owner。

## Current State

当前运行链：

```
legacy core module
        ↓
stable_runtime.install()
        ↓
动态覆盖 proposal_history / generate / save
```

该模式存在 runtime ownership 不清晰的问题。

## Migration Principles

- 不改变现有业务规则
- 不改变已确认的 IP / nickname / bio owner
- 不修改数据库结构
- 每一步必须可测试、可回滚

## Phase A: Internal Migration

目标：

保留外部入口兼容，但内部实现改为 canonical runtime provider。

要求：

- stable runtime 负责稳定输出读取
- legacy core 仅作为 fallback
- 禁止新增 final proposal writer

## Phase B: Contract Migration

更新：

- runtime ownership contract
- preview checks
- CI checks

移除对内部 patch 行为的依赖。

## Phase C: Cleanup

确认所有测试通过后：

- 删除 legacy install 依赖
- 固化 canonical runtime baseline
- 更新文档
