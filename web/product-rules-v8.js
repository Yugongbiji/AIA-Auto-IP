// 产品规则 V8：IP 人设不再向用户询问或展示“生成偏好”。
(function () {
  // generationNotes 仅兼容历史数据/内部理解，不再作为 onboarding 字段或资料卡字段展示。
  if (typeof renderProfile === 'function') {
    const baseRenderProfileV8 = renderProfile;
    renderProfile = function renderProfileV8() {
      baseRenderProfileV8();
      const card = document.getElementById('profile-card');
      if (!card) return;
      [...card.querySelectorAll('.profile-group')].forEach((group) => {
        const label = group.querySelector('.profile-label')?.textContent?.trim();
        if (label === '生成偏好' || label === '个人介绍' || label === '自我介绍') group.remove();
      });
      // 完成度只按真正需要向用户确认的 IP 字段计算，不把历史内部字段算进去。
      const completion = document.getElementById('completion');
      if (completion && typeof questions !== 'undefined') {
        const visibleKeys = ['name', 'agentId', ...questions.map((q) => q.key)];
        const known = visibleKeys.filter((key) => state.profile[key] && !['跳过', '不希望填写'].includes(state.profile[key]));
        completion.textContent = `${Math.round((known.length / visibleKeys.length) * 100)}%`;
      }
    };
  }
})();
