// 产品规则 V9：匹配资料后统一扫描缺失字段；把“做自媒体目的”纳入 IP onboarding。
(function () {
  // 1) purpose 是报名资料里的正式字段。此前后端会返回，但前端 questions 未包含它，
  // 导致 purpose 缺失时仍直接从 city 开始问。
  if (!questions.some((item) => item.key === 'purpose')) {
    const purposeQuestion = {
      key: 'purpose',
      label: '做自媒体目的',
      ask: '你做自媒体最主要想达到什么目的？比如拓客、增员、打造个人品牌，也可以直接说自己的情况。',
      chips: ['拓客', '增员', '打造个人品牌'],
    };
    const agentIdIndex = questions.findIndex((item) => item.key === 'agentId');
    const insertAt = agentIdIndex >= 0 ? agentIdIndex + 1 : 0;
    questions.splice(insertAt, 0, purposeQuestion);
  }

  // 2) 已匹配资料摘要里，如果已有自媒体目的，可直接展示，让用户知道系统确实拿到了这项资料。
  if (typeof ipKnownSummary === 'function') {
    const baseIpKnownSummaryV9 = ipKnownSummary;
    ipKnownSummary = function ipKnownSummaryV9(profile) {
      const base = baseIpKnownSummaryV9(profile);
      const purpose = profile?.purpose;
      if (purpose && purpose !== '跳过' && purpose !== '不希望填写' && !base.some(([label]) => label === '自媒体目的')) {
        return [['自媒体目的', purpose], ...base].slice(0, 4);
      }
      return base;
    };
  }

  // 3) 完成度按“已填写或明确跳过 = 已处理”计算；问题顺序只由 questions 决定。
  if (typeof renderProfile === 'function') {
    const baseRenderProfileV9 = renderProfile;
    renderProfile = function renderProfileV9() {
      baseRenderProfileV9();
      const completion = document.getElementById('completion');
      if (!completion) return;
      const keys = [...new Set(questions.map((q) => q.key))];
      const handled = keys.filter((key) => {
        const value = state.profile[key];
        return Boolean(value) || value === '跳过' || value === '不希望填写';
      });
      completion.textContent = `${Math.round((handled.length / Math.max(keys.length, 1)) * 100)}%`;
    };
  }
})();
