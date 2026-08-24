// IP 人设悬浮入口：圆形“我的 IP 资料” + 红色“最新 IP 方案”。
// 两个入口只在 IP 人设页显示；资料入口支持点击展开，按钮组可拖动，最新方案存在时才显示。
(function () {
  const panel = document.querySelector('.profile-panel');
  if (!panel) return;

  panel.classList.add('profile-floating-detail');
  panel.setAttribute('aria-expanded', 'false');

  const actions = document.createElement('div');
  actions.className = 'ip-floating-actions';
  actions.setAttribute('aria-label', 'IP 快捷入口');

  const profileButton = document.createElement('button');
  profileButton.type = 'button';
  profileButton.className = 'ip-floating-button ip-floating-profile-button';
  profileButton.innerHTML = '<span aria-hidden="true">✨</span><span>我的 IP 资料</span>';
  profileButton.setAttribute('aria-label', '我的 IP 资料');
  profileButton.setAttribute('title', '我的 IP 资料');
  profileButton.setAttribute('aria-expanded', 'false');

  const proposalButton = document.createElement('button');
  proposalButton.type = 'button';
  proposalButton.className = 'ip-floating-button ip-floating-proposal-button hidden';
  proposalButton.innerHTML = '<span aria-hidden="true">★</span><span>最新 IP 方案</span>';

  actions.append(profileButton, proposalButton);
  document.body.appendChild(actions);

  function isIpVisible() {
    return state.activeTool === 'ip' && !document.getElementById('ip-chat-panel')?.classList.contains('hidden');
  }

  function closeProfileDetail() {
    panel.classList.remove('profile-floating-detail-open');
    panel.setAttribute('aria-expanded', 'false');
    profileButton.setAttribute('aria-expanded', 'false');
  }

  function toggleProfileDetail() {
    const next = !panel.classList.contains('profile-floating-detail-open');
    panel.classList.toggle('profile-floating-detail-open', next);
    panel.setAttribute('aria-expanded', next ? 'true' : 'false');
    profileButton.setAttribute('aria-expanded', next ? 'true' : 'false');
    if (next) panel.scrollTop = 0;
  }

  function syncProposalButton() {
    const latest = state.proposals?.[0];
    proposalButton.classList.toggle('hidden', !latest);
    if (latest) proposalButton.querySelector('span:last-child').textContent = `最新 IP 方案 · V${latest.version}`;
  }

  function syncVisibility() {
    const visible = isIpVisible();
    actions.classList.toggle('hidden', !visible);
    if (!visible) closeProfileDetail();
    syncProposalButton();
  }

  profileButton.addEventListener('click', (event) => {
    if (actions.dataset.dragged === '1') return;
    event.preventDefault();
    event.stopPropagation();
    toggleProfileDetail();
  });

  proposalButton.addEventListener('click', (event) => {
    if (actions.dataset.dragged === '1') return;
    event.preventDefault();
    const latest = state.proposals?.[0];
    if (latest) renderProposal(latest.proposal, latest.version);
  });

  document.addEventListener('click', (event) => {
    if (!panel.classList.contains('profile-floating-detail-open')) return;
    if (panel.contains(event.target) || actions.contains(event.target)) return;
    closeProfileDetail();
  });

  function ensureConversationHint() {
    let hint = panel.querySelector('.profile-conversation-hint');
    if (hint) return;
    hint = document.createElement('p');
    hint.className = 'profile-conversation-hint';
    hint.textContent = '💬 想修改资料，直接在 IP 对话框里告诉我即可。';
    document.getElementById('profile-card')?.insertAdjacentElement('afterend', hint);
  }

  function appendPeerReview(card) {
    const summary = String(state.profile?.peerReviewKeywords || '').trim();
    if (!summary) return;
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
  }

  renderProfile = function renderReadOnlyFloatingProfile() {
    const keys = [...new Set(['name', 'agentId', ...questions.map((q) => q.key)])];
    const handled = keys.filter((key) => {
      const value = state.profile[key];
      return Boolean(value) || value === '跳过' || value === '不希望填写';
    });
    document.getElementById('completion').textContent = `${Math.round((handled.length / Math.max(keys.length, 1)) * 100)}%`;
    const card = document.getElementById('profile-card');
    card.innerHTML = '';
    keys.forEach((key) => {
      const group = document.createElement('div');
      group.className = 'profile-group';
      const label = document.createElement('span');
      label.className = 'profile-label';
      label.textContent = labels[key] || key;
      const value = document.createElement('div');
      value.className = `profile-value ${state.profile[key] ? '' : 'profile-empty'}`.trim();
      value.textContent = state.profile[key] || '待补充';
      group.append(label, value);
      card.appendChild(group);
    });
    appendPeerReview(card);
    ensureConversationHint();
    document.getElementById('generate-button').disabled = !state.done;
    syncVisibility();
  };

  // 只有真正发生明显位移才视为拖动；普通点击优先打开资料。
  let drag = null;
  actions.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const rect = actions.getBoundingClientRect();
    drag = { startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, moved: false };
  });
  actions.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.hypot(dx, dy) < 14 && !drag.moved) return;
    drag.moved = true;
    event.preventDefault();
    const maxLeft = Math.max(8, window.innerWidth - actions.offsetWidth - 8);
    const maxTop = Math.max(8, window.innerHeight - actions.offsetHeight - 8);
    const left = Math.min(maxLeft, Math.max(8, drag.left + dx));
    const top = Math.min(maxTop, Math.max(8, drag.top + dy));
    actions.style.left = `${left}px`;
    actions.style.top = `${top}px`;
    actions.style.right = 'auto';
    actions.style.bottom = 'auto';
  });
  function endDrag() {
    if (!drag) return;
    if (drag.moved) {
      actions.dataset.dragged = '1';
      setTimeout(() => { actions.dataset.dragged = '0'; }, 120);
      try { localStorage.setItem('aia-ip-floating-position', JSON.stringify({ left: actions.style.left, top: actions.style.top })); } catch (_) {}
    }
    drag = null;
  }
  actions.addEventListener('pointerup', endDrag);
  actions.addEventListener('pointercancel', endDrag);

  try {
    const saved = JSON.parse(localStorage.getItem('aia-ip-floating-position') || 'null');
    if (saved?.left && saved?.top) {
      actions.style.left = saved.left;
      actions.style.top = saved.top;
      actions.style.right = 'auto';
      actions.style.bottom = 'auto';
    }
  } catch (_) {}

  const previousSelectTool = selectTool;
  selectTool = function floatingProfileSelectTool(tool) {
    const result = previousSelectTool(tool);
    syncVisibility();
    return result;
  };

  const previousRefreshProposalButton = refreshProposalButton;
  refreshProposalButton = function floatingRefreshProposalButton() {
    const result = previousRefreshProposalButton();
    syncProposalButton();
    return result;
  };

  // 修复当前会话已成功生成方案、但前端状态仍被判定为“无 IP”的情况。
  // 长期历史是否保存仍由原有 matched 逻辑决定；这里只同步本次会话状态。
  const originalFetch = window.fetch.bind(window);
  let latestGeneratedProposal = null;
  window.fetch = async function profileAwareFetch(input, init) {
    const response = await originalFetch(input, init);
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (/\/api\/generate(?:\?|$)/.test(url) && response.ok) {
        const payload = await response.clone().json();
        if (payload?.proposal) latestGeneratedProposal = {
          version: payload.version || state.version,
          proposal: payload.proposal,
          model: payload.model,
        };
      }
    } catch (_) {}
    return response;
  };

  const originalGenerateProposal = generateProposal;
  generateProposal = async function generateProposalWithSessionSync() {
    const before = state.proposals?.length || 0;
    latestGeneratedProposal = null;
    const result = await originalGenerateProposal();
    if (latestGeneratedProposal) {
      const exists = (state.proposals || []).some((item) => Number(item.version) === Number(latestGeneratedProposal.version));
      if (!exists) state.proposals.unshift(latestGeneratedProposal);
    }
    if ((state.proposals?.length || 0) !== before || latestGeneratedProposal) {
      refreshProposalButton();
      updateWorkspaceHeadings();
      syncProposalButton();
      if (state.activeTool === 'recommendation') window.scriptRecommendationV1?.loadRecommendations?.(true);
    }
    return result;
  };
  const generateButton = document.getElementById('generate-button');
  if (generateButton) generateButton.onclick = generateProposal;

  window.addEventListener('resize', () => {
    const rect = actions.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8 || rect.bottom > window.innerHeight - 8) {
      actions.style.left = '';
      actions.style.top = '';
      actions.style.right = '';
      actions.style.bottom = '';
    }
  });

  syncVisibility();
})();
