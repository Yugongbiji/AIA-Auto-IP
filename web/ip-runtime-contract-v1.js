// IP Runtime Contract V1 — 确保新生成方案在进入 state / 持久化后立即执行唯一 IP Policy。
(function () {
  'use strict';

  const PEER_CLAIM = /多人反馈|多人评价|客户反馈|大家都说|大家反馈|身边人反馈|身边人评价/;

  function peerReviewCount(profile) {
    const summary = profile?.peerReviewSummary;
    if (!summary || typeof summary !== 'object') return 0;
    const explicit = Number(summary.reviewCount || 0);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const buckets = [summary.topTraits, summary.topImpressions, summary.topNicknames, summary.representativeQuotes];
    return buckets.some((items) => Array.isArray(items) && items.length) ? 1 : 0;
  }

  function removeUnsupportedPeerClaims(proposal, profile) {
    if (!proposal || peerReviewCount(profile) > 0) return proposal;
    if (Array.isArray(proposal.advantages)) {
      proposal.advantages = proposal.advantages.filter((item) => {
        const value = [item?.title, item?.text].filter(Boolean).join(' ');
        return !PEER_CLAIM.test(value);
      });
    }
    if (Array.isArray(proposal.tags)) {
      proposal.tags = proposal.tags.filter((item) => !PEER_CLAIM.test(String(item || '')));
    }
    return proposal;
  }

  async function persistCanonical(entry) {
    if (!state?.matched || !entry?.proposal || !entry?.version || !state?.profile?.agentId) return false;
    try {
      const response = await fetch('/api/proposal/canonical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: state.profile.agentId,
          version: entry.version,
          proposal: entry.proposal,
        }),
      });
      return response.ok;
    } catch (_) {
      return false;
    }
  }

  function canonicalizeEntry(entry) {
    if (!entry?.proposal) return entry;
    window.aiaIpPolicy?.prepareProfileGoal?.(state.profile || {});
    window.aiaIpPolicy?.enforceProposal?.(entry.proposal, state.profile || {});
    removeUnsupportedPeerClaims(entry.proposal, state.profile || {});
    return entry;
  }

  function canonicalizeLoadedProposals() {
    (state?.proposals || []).forEach(canonicalizeEntry);
  }

  canonicalizeLoadedProposals();

  if (typeof startWorkspace === 'function') {
    const baseStartWorkspace = startWorkspace;
    startWorkspace = function canonicalStartWorkspace() {
      const result = baseStartWorkspace.apply(this, arguments);
      canonicalizeLoadedProposals();
      return result;
    };
  }

  if (typeof generateProposal === 'function') {
    const baseGenerateProposal = generateProposal;
    generateProposal = async function canonicalGenerateProposal() {
      const beforeVersion = state?.proposals?.[0]?.version;
      const result = await baseGenerateProposal.apply(this, arguments);
      const entry = state?.proposals?.[0];
      if (entry && entry.version !== beforeVersion) {
        canonicalizeEntry(entry);
        await persistCanonical(entry);
        window.aiaScriptRecommendation?.reset?.();
        refreshProposalButton?.();
      }
      return result;
    };
  }

  window.aiaIpRuntimeContract = Object.freeze({
    peerReviewCount,
    removeUnsupportedPeerClaims,
    canonicalizeEntry,
    persistCanonical,
  });
})();
