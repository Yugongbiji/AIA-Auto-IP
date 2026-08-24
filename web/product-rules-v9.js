// 产品规则 V9（资料展示兼容层）：报名表 purpose 只作为已有资料展示，不再新增独立 purpose 提问。
// 最终业务目标只由 ip-policy-core.js 的 primaryGoal（二选一）负责。
(function () {
  'use strict';
  if (typeof ipKnownSummary === 'function') {
    const baseIpKnownSummaryV9 = ipKnownSummary;
    ipKnownSummary = function ipKnownSummaryV9(profile) {
      const base = baseIpKnownSummaryV9(profile);
      const purpose = profile?.purpose;
      if (purpose && !base.some(([label]) => label === '自媒体目的')) return [['自媒体目的', purpose], ...base].slice(0, 4);
      return base;
    };
  }
  if (typeof renderProfile === 'function') {
    const baseRenderProfileV9 = renderProfile;
    renderProfile = function renderProfileV9() {
      const result = baseRenderProfileV9();
      const completion = document.getElementById('completion');
      if (!completion || !Array.isArray(questions)) return result;
      const keys = [...new Set(questions.map((q) => q.key))];
      const handled = keys.filter((key) => Boolean(state.profile[key]));
      completion.textContent = `${Math.round((handled.length / Math.max(keys.length, 1)) * 100)}%`;
      return result;
    };
  }
  window.aiaPurposeDisplayV9 = Object.freeze({ ownsGoal:false });
})();
