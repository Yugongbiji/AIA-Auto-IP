// 发布收口补丁：只补 stable IP 方案卡片，不改生成逻辑、不写数据库。
(function () {
  'use strict';

  function hasProposalCard() {
    const messages = document.getElementById('messages');
    if (!messages) return false;
    if (messages.querySelector('[data-stable-proposal-card="1"]')) return true;
    return [...messages.querySelectorAll('.plan-gift-card')].some((node) => /专属\s*IP\s*方案/.test(node.textContent || ''));
  }

  function ensureStableProposalCard() {
    if (!state?.matched || !Array.isArray(state.proposals) || !state.proposals.length) return;
    const latest = state.proposals[0];
    const proposal = latest?.proposal;
    if (!proposal?._stableMeta?.approved || hasProposalCard()) return;
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
    startWorkspace = function releaseStableUiStartWorkspace() {
      const result = base.apply(this, arguments);
      queueMicrotask(ensureStableProposalCard);
      return result;
    };
  }

  window.aiaReleaseStableUiV2 = Object.freeze({ ensureStableProposalCard });
})();
