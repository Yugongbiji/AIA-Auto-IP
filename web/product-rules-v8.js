// 产品规则 V8：只隐藏内部“生成偏好”，个人介绍必须保留展示。
(function () {
  'use strict';
  if (typeof renderProfile !== 'function') return;
  const baseRenderProfileV8 = renderProfile;
  renderProfile = function renderProfileV8() {
    const result = baseRenderProfileV8();
    const card = document.getElementById('profile-card');
    if (card) {
      [...card.querySelectorAll('.profile-group')].forEach((group) => {
        const label = group.querySelector('.profile-label')?.textContent?.trim();
        if (label === '生成偏好') group.remove();
      });
    }
    const completion = document.getElementById('completion');
    if (completion && typeof questions !== 'undefined') {
      const visibleKeys = [...new Set(['name', 'agentId', ...questions.map((q) => q.key)])];
      const known = visibleKeys.filter((key) => Boolean(state.profile[key]));
      completion.textContent = `${Math.round((known.length / Math.max(visibleKeys.length, 1)) * 100)}%`;
    }
    return result;
  };
})();
