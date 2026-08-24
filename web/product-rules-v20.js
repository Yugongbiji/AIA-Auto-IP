// 产品规则 V20：清理跳过类选项；统一 IP 内容方向与脚本推荐；增加方案到脚本推荐入口。
(function () {
  const OMIT = /^(其他|其它|不希望填写|跳过|暂不填写|不愿填写|不想填写)$/;
  if (Array.isArray(questions)) questions.forEach((question) => {
    if (Array.isArray(question.chips)) question.chips = question.chips.filter((chip) => !OMIT.test(String(chip || '').trim()));
  });

  function strategyFor(proposal) {
    return typeof window.buildIpContentStrategy === 'function' ? window.buildIpContentStrategy(state.profile || {}, proposal || state.proposals?.[0]?.proposal || {}) : { lines: [] };
  }
  window.currentIpContentDirectionsV20 = function (proposal) {
    const strategy = strategyFor(proposal);
    const insurance = (strategy.lines || []).find((line) => line.kind === 'acquisition' || line.kind === 'recruitment');
    const branch = (strategy.lines || []).find((line) => line.kind === 'general');
    return { insurance: insurance?.directions || [], branch: branch?.directions || [], branchTitle: branch?.title || '内容支线', branchSource: branch?.source || '', all: [...new Set([...(insurance?.directions || []), ...(branch?.directions || [])].filter(Boolean))] };
  };

  function ensureDirectionHeadingAndButton(content) {
    const section = content?.querySelector('.ip-content-strategy'); if (!section) return;
    const title = section.querySelector('.ip-strategy-head h2'); if (title) title.textContent = '内容方向';
    const intro = section.querySelector('.ip-strategy-head p:not(.eyebrow)'); if (intro) intro.textContent = '根据你的目标、人设和真实资料，确定长期稳定的保险主线与内容支线。';
    section.querySelector('.ip-to-recommendation')?.remove();
    const action = document.createElement('div'); action.className = 'ip-to-recommendation';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'primary'; button.textContent = '查看推荐脚本';
    button.addEventListener('click', async () => { document.getElementById('proposal-screen')?.classList.add('hidden'); selectTool('recommendation'); await window.scriptRecommendationV1?.loadRecommendations?.(true); });
    action.appendChild(button); section.appendChild(action);
  }
  if (!document.getElementById('ip-direction-v20-style')) { const style = document.createElement('style'); style.id = 'ip-direction-v20-style'; style.textContent = '.ip-to-recommendation{display:flex;justify-content:center;padding:22px 0 4px}.ip-to-recommendation .primary{min-width:180px}'; document.head.appendChild(style); }
  if (typeof renderProposal === 'function') { const baseRender = renderProposal; renderProposal = function (proposal, version) { const result = baseRender(proposal, version); ensureDirectionHeadingAndButton(document.getElementById('proposal-content')); return result; }; }

  // 进入脚本推荐时强制按当前档案重新取一次推荐，避免旧批次把“育儿”显示成此前的支线。
  if (typeof selectTool === 'function') {
    const baseSelect = selectTool;
    selectTool = function selectToolV20(tool) {
      const result = baseSelect(tool);
      if (tool === 'recommendation') Promise.resolve(window.scriptRecommendationV1?.loadRecommendations?.(true)).catch(() => {});
      return result;
    };
  }
})();
