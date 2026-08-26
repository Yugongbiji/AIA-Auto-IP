// 产品规则 V9（资料展示兼容层）：报名表 purpose 只作为已有资料展示。
// primaryGoal 由 ip-policy-core.js 唯一负责；资料完成度由现有资料 UI Owner 负责，本文件不得重算。
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
  window.aiaPurposeDisplayV9 = Object.freeze({ ownsGoal:false, ownsCompletion:false });
})();
