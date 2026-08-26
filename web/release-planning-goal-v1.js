// Release closure patch: binary planning goal + loaded proposal card.
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

  // /api/lookup already loads the authoritative proposal into state.proposals.
  // Surface that loaded proposal in the conversation. This is display-only:
  // no generation, no save, no proposal version mutation.
  function hasProposalCard() {
    const messages = document.getElementById('messages');
    if (!messages) return false;
    if (messages.querySelector('[data-loaded-proposal-card="1"]')) return true;
    return [...messages.querySelectorAll('.plan-gift-card')].some((node) => /专属\s*IP\s*方案/.test(node.textContent || ''));
  }

  function ensureLoadedProposalCard() {
    if (!state?.matched || !Array.isArray(state.proposals) || !state.proposals.length || hasProposalCard()) return;
    const latest = state.proposals[0];
    if (!latest?.proposal) return;
    if (typeof addMessage !== 'function' || typeof renderPlanCard !== 'function' || typeof renderProposal !== 'function') return;

    const card = addMessage('', 'assistant', false);
    card.dataset.loadedProposalCard = '1';
    renderPlanCard(card, {
      eyebrow: `专属 IP 方案 V${latest.version} 已确认`,
      title: '你的专属 IP 方案',
      subtitle: '方案已经准备好了，点击即可查看。',
      buttonText: '查看 IP 方案',
      onView: () => renderProposal(latest.proposal, latest.version),
    });
  }

  if (typeof startWorkspace === 'function') {
    const base = startWorkspace;
    startWorkspace = function releaseLoadedProposalStartWorkspace() {
      const result = base.apply(this, arguments);
      // Run after the base workspace has restored history and rendered its first question.
      setTimeout(ensureLoadedProposalCard, 0);
      return result;
    };
  }

  window.aiaReleasePlanningGoalV1 = Object.freeze({ ensureLoadedProposalCard });
})();
