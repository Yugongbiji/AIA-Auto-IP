# 小红书笔记搜索 Implementation Plan

**Goal:** 在 AIA Auto IP 增加 Wellbyte V4 小红书笔记搜索、分页、在线表格、详情抽屉和前50条 Excel 导出。

**Architecture:** 前端独立模块；后端通过 WELLBYTE_API_KEY 代理 Wellbyte；Excel 由 openpyxl 生成；Preview 通过 GitHub Actions secret 注入 API Key。

**Spec:** docs/superpowers/specs/2026-11-12-xhs-note-search-design.md

## Tasks
- [x] 探索现有导航、服务器路由、Preview 部署和前端设计规范。
- [x] 创建独立开发分支。
- [ ] 增加后端搜索代理与 Excel 导出路由。
- [ ] 增加独立前端页面、在线表格、分页、详情抽屉。
- [ ] 增加 API Key 安全配置与 Preview 注入。
- [ ] 增加自动化契约测试并执行全量回归。
- [ ] 创建 PR、部署 Preview，等待业务验收。
- [ ] 验收通过后合并 main。

## Review focus
- 绝不把 Wellbyte API Key 暴露到浏览器。
- 收藏排序必须使用 collect_descending，而不是 popularity_descending。
- 导出最多 50 条，只使用已加载结果，不触发额外搜索。
- 翻页不能串关键词、筛选条件或重复笔记。
- 原有 IP、脚本推荐、脚本改写和小红书排版不回归。
