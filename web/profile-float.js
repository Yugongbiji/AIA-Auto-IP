// IP 人设悬浮入口：圆形“我的 IP 资料” + 红色“最新 IP 方案”。
// 只在“已进入工作台的 IP 对话页”显示；登录页、方案页、脚本推荐、脚本改写、小红书等一律隐藏。
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

  function overlayOpen() {
    return ['proposal-screen', 'content-plan-screen', 'script-detail-screen'].some((id) => !document.getElementById(id)?.classList.contains('hidden'));
  }

  function workspaceReady() {
    const workspace = document.getElementById('workspace');
    const identity = document.getElementById('identity-screen');
    return !!workspace
      && !workspace.classList.contains('hidden')
      && (!identity || identity.classList.contains('hidden'));
  }

  function isIpVisible() {
    return workspaceReady()
      && state.activeTool === 'ip'
      && !document.getElementById('ip-chat-panel')?.classList.contains('hidden')
      && !overlayOpen();
  }

  function closeProfileDetail() {
    panel.classList.remove('profile-floating-detail-open');
    panel.setAttribute('aria-expanded', 'false');
    profileButton.setAttribute('aria-expanded', 'false');
  }

  function ensureCloseButton() {
    const title = panel.querySelector('.profile-title');
    if (!title || title.querySelector('.profile-floating-close')) return;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'profile-floating-close';
    close.setAttribute('aria-label', '关闭我的 IP 资料');
    close.setAttribute('title', '关闭');
    close.textContent = '×';
    close.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeProfileDetail();
    });
    title.appendChild(close);
  }

  function toggleProfileDetail() {
    const next = !panel.classList.contains('profile-floating-detail-open');
    panel.classList.toggle('profile-floating-detail-open', next);
    panel.setAttribute('aria-expanded', next ? 'true' : 'false');
    profileButton.setAttribute('aria-expanded', next ? 'true' : 'false');
    if (next) {
      ensureCloseButton();
      panel.scrollTop = 0;
    }
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
    if (latest) {
      closeProfileDetail();
      renderProposal(latest.proposal, latest.version);
      queueMicrotask(syncVisibility);
    }
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
    ensureCloseButton();
    document.getElementById('generate-button').disabled = !state.done;
    syncVisibility();
  };

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

  const visibilityObserver = new MutationObserver(syncVisibility);
  ['workspace', 'identity-screen', 'ip-chat-panel', 'proposal-screen', 'content-plan-screen', 'script-detail-screen'].forEach((id) => {
    const target = document.getElementById(id);
    if (target) visibilityObserver.observe(target, { attributes: true, attributeFilter: ['class'] });
  });

  if (!document.getElementById('profile-floating-close-style')) {
    const style = document.createElement('style');
    style.id = 'profile-floating-close-style';
    style.textContent = `.profile-floating-close{width:34px;height:34px;flex:0 0 34px;border:0;border-radius:50%;background:#f5f1f2;color:#5f5559;font-size:24px;line-height:1;cursor:pointer;display:grid;place-items:center}.profile-floating-close:hover{background:#eee7e9}.profile-floating-close:focus-visible{outline:3px solid #d3114540;outline-offset:2px}`;
    document.head.appendChild(style);
  }

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