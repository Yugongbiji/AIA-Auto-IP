// 产品规则 V20：清理询问中的跳过类选项；统一 IP 内容方向与脚本推荐；增加方案到脚本推荐入口。
(function () {
  const OMIT = /^(其他|其它|不希望填写|跳过|暂不填写|不愿填写|不想填写)$/;
  if (Array.isArray(questions)) {
    questions.forEach((question) => {
      if (Array.isArray(question.chips)) question.chips = question.chips.filter((chip) => !OMIT.test(String(chip || '').trim()));
      if (question.ask) question.ask = String(question.ask)
        .replace(/；?如有其他荣誉，也可以自行输入。?/g, '；也可以自行输入补充。')
        .replace(/，?也可以自己补充/g, '，也可以自行输入补充')
        .replace(/，?也可以自行输入补充/g, '，也可以自行输入补充');
    });
  }

  function strategyFor(proposal) {
    return typeof window.buildIpContentStrategy === 'function'
      ? window.buildIpContentStrategy(state.profile || {}, proposal || state.proposals?.[0]?.proposal || {})
      : { lines: [] };
  }

  function ensureDirectionHeadingAndButton(content, proposal) {
    const section = content?.querySelector('.ip-content-strategy');
    if (!section) return;
    const title = section.querySelector('.ip-strategy-head h2');
    if (title) title.textContent = '内容方向';
    const intro = section.querySelector('.ip-strategy-head p:not(.eyebrow)');
    if (intro) intro.textContent = '根据你的目标、人设和真实资料，确定长期稳定的保险主线与内容支线。';
    section.querySelector('.ip-to-recommendation')?.remove();
    const action = document.createElement('div');
    action.className = 'ip-to-recommendation';
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'primary'; button.textContent = '查看推荐脚本';
    button.addEventListener('click', () => {
      document.getElementById('proposal-screen')?.classList.add('hidden');
      if (window.scriptRecommendationV1?.reset) window.scriptRecommendationV1.reset();
      selectTool('recommendation');
    });
    action.appendChild(button); section.appendChild(action);
  }

  if (!document.getElementById('ip-direction-v20-style')) {
    const style = document.createElement('style'); style.id = 'ip-direction-v20-style';
    style.textContent = '.ip-to-recommendation{display:flex;justify-content:center;padding:22px 0 4px}.ip-to-recommendation .primary{min-width:180px}';
    document.head.appendChild(style);
  }

  if (typeof renderProposal === 'function') {
    const baseRender = renderProposal;
    renderProposal = function renderProposalV20(proposal, version) {
      const result = baseRender(proposal, version);
      ensureDirectionHeadingAndButton(document.getElementById('proposal-content'), proposal);
      return result;
    };
  }

  // 唯一真源：脚本推荐直接读取当前 IP 方案使用的 buildIpContentStrategy，不再另造支线名称。
  window.currentIpContentDirectionsV20 = function currentIpContentDirectionsV20(proposal) {
    const strategy = strategyFor(proposal);
    const insurance = (strategy.lines || []).find((line) => line.kind === 'acquisition' || line.kind === 'recruitment');
    const branch = (strategy.lines || []).find((line) => line.kind === 'general');
    return {
      insurance: insurance?.directions || [],
      branch: branch?.directions || [],
      branchTitle: branch?.title || '内容支线',
      branchSource: branch?.source || '',
      all: [...new Set([...(insurance?.directions || []), ...(branch?.directions || [])].filter(Boolean))],
    };
  };
})();
