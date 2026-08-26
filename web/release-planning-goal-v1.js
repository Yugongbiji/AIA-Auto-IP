// Release closure patch: binary planning goal + stable proposal card + multi-select presentation.
(function () {
  'use strict';

  // Keep content planning aligned with the current two-way IP goal policy.
  if (Array.isArray(planningQuestions) && planningQuestions.length) {
    planningQuestions[0] = {
      key: 'primaryGoal',
      ask: '刚刚起号阶段，建议先从“拓客”和“增员”里选一个方向，不要贪多。先把一个方向做清楚，等账号运营成熟后再拓展另一个方向。现阶段你更希望这个账号优先帮你：',
      chips: ['吸引潜在客户', '吸引潜在增员对象'],
    };
  }

  // Approved stable outputs already exist in state.proposals after /api/lookup.
  // When there is no historical generation message, surface a view card only;
  // never regenerate, save, or create a new proposal version here.
  function hasProposalCard() {
    const messages = document.getElementById('messages');
    if (!messages) return false;
    if (messages.querySelector('[data-stable-proposal-card="1"]')) return true;
    return [...messages.querySelectorAll('.plan-gift-card')].some((node) => /专属\s*IP\s*方案/.test(node.textContent || ''));
  }

  function ensureStableProposalCard() {
    if (!state?.matched || !Array.isArray(state.proposals) || !state.proposals.length) return;
    const latest = state.proposals[0];
    if (!latest?.proposal?._stableMeta?.approved || hasProposalCard()) return;
    if (typeof addMessage !== 'function' || typeof renderPlanCard !== 'function' || typeof renderProposal !== 'function') return;
    const card = addMessage('', 'assistant', false);
    card.dataset.stableProposalCard = '1';
    renderPlanCard(card, {
      eyebrow: `专属 IP 方案 V${latest.version} 已确认`,
      title: '你的专属 IP 方案',
      subtitle: '已载入人工确认的稳定版本，可直接查看昵称、一句话 IP 与平台简介。',
      buttonText: '查看 IP 方案',
      onView: () => renderProposal(latest.proposal, latest.version),
    });
  }

  if (typeof startWorkspace === 'function') {
    const base = startWorkspace;
    startWorkspace = function releaseStableStartWorkspace() {
      const result = base.apply(this, arguments);
      queueMicrotask(ensureStableProposalCard);
      return result;
    };
  }

  // Presentation-only repair for both questionnaire and planning multi-select controls.
  if (!document.getElementById('release-multiselect-style-v2')) {
    const style = document.createElement('style');
    style.id = 'release-multiselect-style-v2';
    style.textContent = `
      .quick-replies{align-items:center}
      .quick-replies .custom-multi-input{flex:1 0 100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;min-width:0;margin-top:2px}
      .quick-replies .custom-multi-input input{width:100%;min-width:0;height:40px;padding:9px 12px;border-radius:10px}
      .quick-replies .custom-multi-input button{min-width:64px;height:40px;padding:0 14px;border-radius:10px;font-weight:700}
      .quick-replies .multi-confirm{flex:0 0 auto;min-height:40px;padding:9px 15px;border-radius:10px}
      .quick-replies button.selected,.quick-replies .custom-selected{box-shadow:none}
      @media(max-width:720px){.quick-replies{padding-right:16px;padding-left:16px}.quick-replies .custom-multi-input{grid-template-columns:minmax(0,1fr) 64px}.quick-replies .multi-confirm{flex:1 0 100%;width:100%}}
    `;
    document.head.appendChild(style);
  }

  window.aiaReleasePlanningGoalV1 = Object.freeze({ ensureStableProposalCard });
})();
