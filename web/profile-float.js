// IP 人设悬浮入口：白色“我的 IP 资料” + 红色“最新 IP 方案”。
// 两个入口只在 IP 人设页显示；按钮组可拖动，资料详情点击展开，最新方案存在时才显示。
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
    event.stopPropagation();
    toggleProfileDetail();
  });

  proposalButton.addEventListener('click', () => {
    if (actions.dataset.dragged === '1') return;
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
    ensureConversationHint();
    document.getElementById('generate-button').disabled = !state.done;
    syncVisibility();
  };

  // 拖动的是按钮组，不影响正常页面滚动；拖动后短暂屏蔽 click，防止松手时误打开。
  let drag = null;
  actions.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const rect = actions.getBoundingClientRect();
    drag = { startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, moved: false };
    actions.setPointerCapture?.(event.pointerId);
  });
  actions.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) < 8 && !drag.moved) return;
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
      setTimeout(() => { actions.dataset.dragged = '0'; }, 180);
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
