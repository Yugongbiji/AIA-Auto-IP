// 产品规则 V12（兼容层）：仅保留“撤销独立内容规划入口”的页面兼容。
// 业务目标、内容主线/支线已迁移到 ip-policy-core.js；本文件不得再写这些业务结果。
(function () {
  'use strict';

  const planningTab = document.querySelector('[data-tool="planning"]');
  planningTab?.remove();
  document.getElementById('planning-panel')?.classList.add('hidden');
  document.getElementById('content-plan-screen')?.classList.add('hidden');

  // 兼容历史 planning 跳转：旧入口统一回 IP，不再在这里生成任何内容策略。
  if (typeof selectTool === 'function') {
    const baseSelectToolV12 = selectTool;
    selectTool = function selectToolV12Compatibility(tool) {
      return baseSelectToolV12(tool === 'planning' ? 'ip' : tool);
    };
  }

  window.aiaProductRulesV12 = Object.freeze({
    compatibilityOnly: true,
    ownsBusinessRules: false,
  });
})();
