// IP 资料悬浮条：只在 IP 人设页显示；默认一行，点击展开；资料只展示，修改统一通过对话完成。
(function () {
  const panel = document.querySelector('.profile-panel');
  const toolbar = document.querySelector('.workspace-toolbar');
  if (!panel || !toolbar) return;

  panel.classList.add('profile-float');
  panel.setAttribute('aria-expanded', 'false');

  function isIpVisible() {
    return state.activeTool === 'ip' && !$('ip-chat-panel').classList.contains('hidden');
  }

  function syncPanelVisibility() {
    panel.classList.toggle('profile-float-hidden', !isIpVisible());
  }

  function syncFloatTop() {
    const rect = toolbar.getBoundingClientRect();
    document.documentElement.style.setProperty('--profile-float-top', `${Math.ceil(rect.bottom + 6)}px`);
  }

  function setExpanded(expanded) {
    panel.classList.toggle('profile-float-expanded', expanded);
    panel.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  const title = panel.querySelector('.profile-title');
  title.setAttribute('role', 'button');
  title.setAttribute('tabindex', '0');
  title.setAttribute('aria-label', '展开或收起我的 IP 信息');
  title.addEventListener('click', () => setExpanded(!panel.classList.contains('profile-float-expanded')));
  title.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setExpanded(!panel.classList.contains('profile-float-expanded'));
    }
  });

  function ensureConversationHint() {
    let hint = panel.querySelector('.profile-conversation-hint');
    if (!hint) {
      hint = document.createElement('p');
      hint.className = 'profile-conversation-hint';
      hint.textContent = '💬 如果想修改任何资料，直接在下面的输入框里告诉我哦！';
      const card = $('profile-card');
      card.insertAdjacentElement('afterend', hint);
    }
  }

  renderProfile = function renderReadOnlyFloatingProfile() {
    const keys = ['name', 'agentId', 'selfIntro', 'purpose', ...questions.map((q) => q.key), 'generationNotes'];
    const known = keys.filter((key) => state.profile[key]);
    $('completion').textContent = `${Math.round((known.length / keys.length) * 100)}%`;
    const card = $('profile-card');
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
    $('generate-button').disabled = !state.done;
    syncPanelVisibility();
    syncFloatTop();
  };

  const previousSelectTool = selectTool;
  selectTool = function floatingProfileSelectTool(tool) {
    const result = previousSelectTool(tool);
    syncPanelVisibility();
    syncFloatTop();
    return result;
  };

  window.addEventListener('resize', syncFloatTop);
  if (window.ResizeObserver) new ResizeObserver(syncFloatTop).observe(toolbar);
  syncFloatTop();
  syncPanelVisibility();
})();
