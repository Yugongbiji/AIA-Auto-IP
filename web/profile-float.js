// IP 资料悬浮条：只在 IP 人设页显示；默认一行，点击展开；资料项可直接编辑。
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

  const textAreaKeys = new Set(['selfIntro', 'purpose', 'strengths', 'honors', 'generationNotes']);
  const lockedKeys = new Set(['agentId']);

  async function saveField(key, value, previousValue) {
    state.profile[key] = value;
    if (key === 'name' && state.matched) {
      $('identity-state').textContent = `已匹配：${value || '未填写'}（${state.profile.agentId}）`;
      localStorage.setItem(SESSION_KEY, JSON.stringify({ name: value, agentId: state.profile.agentId }));
    }
    renderProfile();
    if (state.matched) {
      try {
        await persistMatchedProfile();
      } catch (_) {
        state.profile[key] = previousValue;
        renderProfile();
        addMessage('这次修改暂时没有保存成功，请稍后再试。', 'system', false);
      }
    }
  }

  function openInlineEditor(group, key) {
    if (lockedKeys.has(key)) return;
    if (group.querySelector('.profile-inline-editor')) return;
    const previousValue = state.profile[key] || '';
    const editor = document.createElement('div');
    editor.className = 'profile-inline-editor';
    const field = document.createElement(textAreaKeys.has(key) ? 'textarea' : 'input');
    field.value = ['跳过', '不希望填写'].includes(previousValue) ? '' : previousValue;
    field.placeholder = `修改${labels[key] || key}…`;
    const save = document.createElement('button');
    save.type = 'button'; save.className = 'primary'; save.textContent = '保存';
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'secondary-button'; cancel.textContent = '取消';
    save.onclick = async (event) => {
      event.stopPropagation();
      const next = field.value.trim();
      await saveField(key, next, previousValue);
    };
    cancel.onclick = (event) => { event.stopPropagation(); renderProfile(); };
    editor.onclick = (event) => event.stopPropagation();
    editor.append(field, save, cancel);
    group.appendChild(editor);
    field.focus();
  }

  renderProfile = function renderEditableFloatingProfile() {
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
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `profile-edit-row${lockedKeys.has(key) ? ' profile-edit-locked' : ''}`;
      const value = document.createElement('span');
      value.className = `profile-value ${state.profile[key] ? '' : 'profile-empty'}`.trim();
      value.textContent = state.profile[key] || '待补充';
      const icon = document.createElement('span');
      icon.className = 'profile-edit-icon';
      icon.textContent = lockedKeys.has(key) ? '身份字段' : '编辑 ✎';
      row.append(value, icon);
      if (!lockedKeys.has(key)) row.onclick = () => openInlineEditor(group, key);
      group.append(label, row);
      if (lockedKeys.has(key)) {
        const hint = document.createElement('p');
        hint.className = 'profile-inline-hint';
        hint.textContent = '营销员编号用于身份匹配，如需更换请切换账号重新进入。';
        group.appendChild(hint);
      }
      card.appendChild(group);
    });

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

  // 首次介绍结束后必须立刻出现第一个实际问题；若原流程已正常提问则只滚动到该问题，不重复添加。
  const previousStartWorkspace = startWorkspace;
  startWorkspace = function ensureFirstIpQuestion(...args) {
    const result = previousStartWorkspace(...args);
    setTimeout(() => {
      syncPanelVisibility();
      syncFloatTop();
      if (state.activeTool !== 'ip' || state.done) return;
      const question = questions[state.currentQuestion];
      if (!question) return;
      const assistantMessages = Array.from(messages.querySelectorAll('.message.assistant'));
      const alreadyAsked = assistantMessages.some((node) => node.textContent.trim() === question.ask.trim());
      if (!alreadyAsked) presentQuestion();
      messages.scrollTop = messages.scrollHeight;
    }, 30);
    return result;
  };

  window.addEventListener('resize', syncFloatTop);
  if (window.ResizeObserver) new ResizeObserver(syncFloatTop).observe(toolbar);
  syncFloatTop();
  syncPanelVisibility();
})();
