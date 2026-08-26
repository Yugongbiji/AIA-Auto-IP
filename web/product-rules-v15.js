// 产品规则 V15：把多人评价聚合摘要作为独立来源展示在个人档案中。
(function () {
  if (typeof renderProfile !== 'function') return;
  const baseRenderProfileV15 = renderProfile;
  renderProfile = function renderProfileV15() {
    const result = baseRenderProfileV15();
    const summary = String(state.profile?.peerReviewKeywords || '').trim();
    if (!summary) return result;
    const card = document.getElementById('profile-card');
    if (!card || card.querySelector('[data-profile-peer-review="1"]')) return result;
    const group = document.createElement('div');
    group.className = 'profile-group';
    group.dataset.profilePeerReview = '1';
    const label = document.createElement('span');
    label.className = 'profile-label';
    label.textContent = '身边人评价';
    const value = document.createElement('div');
    value.className = 'profile-value';
    value.textContent = summary;
    group.append(label, value);
    card.appendChild(group);
    return result;
  };
})();
