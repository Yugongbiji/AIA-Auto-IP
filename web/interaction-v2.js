// 通用交互 V4：快捷选项只负责填充答案；统一由底部“发送”提交。
// 业务选择状态只读取 app.js 的 state/planningState，不再维护第二套 Set，也不再点击隐藏确认按钮。
// 同时统一自动跟随、移动端 visualViewport、错误重试与长会话滚动边界。
(function () {
  const configs = [
    {
      replies:'quick-replies', form:'chat-form', input:'chat-input', messages:'messages', panel:'ip-chat-panel',
      question:() => (typeof questions !== 'undefined' ? questions[state.currentQuestion] : null),
      selection:() => state.multiSelection,
      toggle:(value) => typeof toggleMultiOption === 'function' && toggleMultiOption(value),
    },
    {
      replies:'planning-quick-replies', form:'planning-form', input:'planning-input', messages:'planning-messages', panel:'planning-panel',
      question:() => (typeof planningQuestions !== 'undefined' ? planningQuestions[planningState.currentQuestion] : null),
      selection:() => planningState.multiSelection,
      toggle:(value) => {
        const question = typeof planningQuestions !== 'undefined' ? planningQuestions[planningState.currentQuestion] : null;
        if (question && typeof togglePlanningOption === 'function') togglePlanningOption(value, question);
      },
    },
  ];

  configs.forEach((cfg) => {
    const replies = document.getElementById(cfg.replies);
    const form = document.getElementById(cfg.form);
    const input = document.getElementById(cfg.input);
    if (!replies || !form || !input) return;

    let editor = null;
    let tray = null;

    function currentSelection() {
      const value = cfg.selection?.();
      return value instanceof Set ? value : new Set();
    }
    function multiActive() { return Boolean(cfg.question?.()?.multiple); }

    function ensureEditor() {
      if (editor && editor.isConnected) return editor;
      editor = document.createElement('div');
      editor.className = 'composer-editor';
      tray = document.createElement('div');
      tray.className = 'composer-selection-tray';
      tray.setAttribute('aria-label', '已选择的快捷答案');
      input.parentNode.insertBefore(editor, input);
      editor.appendChild(tray);
      editor.appendChild(input);
      form.classList.add('composer-v3');
      return editor;
    }

    function syncOptionButtons() {
      const selected = currentSelection();
      replies.querySelectorAll('button').forEach((button) => {
        if (button.classList.contains('multi-confirm') || button.classList.contains('custom-selected')) return;
        const value = String(button.dataset.v3Option || button.textContent || '').trim();
        if (!value) return;
        button.dataset.v3Option = value;
        const active = multiActive() && selected.has(value);
        button.classList.toggle('selected', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    function renderTray() {
      ensureEditor();
      tray.innerHTML = '';
      const selected = currentSelection();
      if (multiActive()) {
        selected.forEach((value) => {
          const chip = document.createElement('span');
          chip.className = 'composer-selection-chip';
          const label = document.createElement('span');
          label.textContent = value;
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.setAttribute('aria-label', `取消选择 ${value}`);
          remove.textContent = '×';
          remove.addEventListener('pointerdown', (event) => event.preventDefault());
          remove.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            cfg.toggle?.(value);
          });
          chip.append(label, remove);
          tray.appendChild(chip);
        });
      }
      editor.classList.toggle('has-chips', multiActive() && selected.size > 0);
    }

    function upgradeChoices() {
      ensureEditor();
      if (!multiActive()) {
        replies.classList.remove('quick-replies-v3');
        renderTray();
        syncOptionButtons();
        return;
      }

      replies.classList.add('quick-replies-v3');
      // 旧 app.js 仍会生成这些兼容节点；V4 直接移除，不允许它们成为第二输入/提交入口。
      replies.querySelectorAll('.custom-multi-input,.multi-confirm,.custom-selected').forEach((node) => node.remove());
      replies.querySelectorAll('button').forEach((button) => {
        const value = String(button.textContent || '').trim();
        if (!value) return;
        button.dataset.v3Option = value;
        button.addEventListener('pointerdown', (event) => event.preventDefault(), { once:false });
      });
      renderTray();
      syncOptionButtons();
    }

    new MutationObserver(() => queueMicrotask(upgradeChoices)).observe(replies, { childList:true, subtree:true });
    replies.addEventListener('click', () => queueMicrotask(() => { renderTray(); syncOptionButtons(); }), true);
    form.addEventListener('submit', () => queueMicrotask(() => { renderTray(); syncOptionButtons(); }), true);
    ensureEditor();
    upgradeChoices();
  });

  // 全工作台统一自动跟随：新问题/新回复出现后，保证最新内容进入可视区。
  document.querySelectorAll('.chat-panel').forEach((panel) => {
    const messages = panel.querySelector('.messages');
    const replies = panel.querySelector('.quick-replies');
    const form = panel.querySelector('.composer');
    if (!messages) return;

    let userReadingHistory = false;
    let userScrollIntent = false;
    let scrollTimer = null;

    const latest = document.createElement('button');
    latest.type = 'button';
    latest.className = 'chat-latest-button';
    latest.textContent = '回到最新 ↓';
    latest.setAttribute('aria-label', '回到最新消息');
    panel.appendChild(latest);

    function distanceFromBottom() {
      return Math.max(0, messages.scrollHeight - messages.scrollTop - messages.clientHeight);
    }

    function setReadingHistory(value) {
      userReadingHistory = value;
      panel.classList.toggle('show-latest-button', value);
    }

    function scrollToLatest(behavior = 'smooth') {
      if (!messages.isConnected) return;
      setReadingHistory(false);
      messages.scrollTo({ top:messages.scrollHeight + 200, behavior });
    }

    function scheduleFollow() {
      if (userReadingHistory) {
        panel.classList.add('show-latest-button');
        return;
      }
      clearTimeout(scrollTimer);
      requestAnimationFrame(() => scrollToLatest('smooth'));
      scrollTimer = setTimeout(() => scrollToLatest('smooth'), 80);
      setTimeout(() => {
        if (!userReadingHistory) scrollToLatest('auto');
      }, 220);
    }

    latest.addEventListener('click', () => {
      userScrollIntent = false;
      scrollToLatest('auto');
      requestAnimationFrame(() => scrollToLatest('auto'));
      setTimeout(() => scrollToLatest('auto'), 80);
    });

    ['wheel','touchstart','pointerdown'].forEach((eventName) => {
      messages.addEventListener(eventName, () => { userScrollIntent = true; }, { passive:true });
    });
    messages.addEventListener('scroll', () => {
      if (!userScrollIntent) return;
      setReadingHistory(distanceFromBottom() > 100);
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => { userScrollIntent = false; }, 160);
    }, { passive:true });

    const contentObserver = new MutationObserver((mutations) => {
      const changed = mutations.some((mutation) => mutation.addedNodes?.length || mutation.removedNodes?.length || mutation.type === 'characterData');
      if (changed) scheduleFollow();
    });
    contentObserver.observe(messages, { childList:true, subtree:true, characterData:true });
    if (replies) contentObserver.observe(replies, { childList:true, subtree:true, characterData:true });

    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        if (!userReadingHistory) scheduleFollow();
      });
      resizeObserver.observe(messages);
      if (replies) resizeObserver.observe(replies);
      if (form) resizeObserver.observe(form);
    }

    if (form) {
      form.addEventListener('submit', () => {
        userScrollIntent = false;
        setReadingHistory(false);
        scheduleFollow();
      }, true);
    }

    setTimeout(() => {
      if (!panel.classList.contains('hidden')) scrollToLatest('auto');
    }, 60);
  });

  // 移动端键盘 / visualViewport：让工作区高度跟随真正可见区域。
  const viewport = window.visualViewport;
  function syncVisualViewport() {
    const height = Math.round(viewport?.height || window.innerHeight);
    const offsetTop = Math.round(viewport?.offsetTop || 0);
    const keyboardInset = Math.max(0, Math.round(window.innerHeight - height - offsetTop));
    document.documentElement.style.setProperty('--aia-viewport-height', `${height}px`);
    document.documentElement.style.setProperty('--aia-keyboard-inset', `${keyboardInset}px`);
    document.body.classList.toggle('keyboard-open', keyboardInset > 120);

    const active = document.activeElement;
    if (document.body.classList.contains('keyboard-open') && active && active.closest?.('.composer')) {
      requestAnimationFrame(() => active.closest('.composer')?.scrollIntoView({ block:'end', behavior:'auto' }));
    }
  }
  syncVisualViewport();
  window.addEventListener('resize', syncVisualViewport, { passive:true });
  viewport?.addEventListener('resize', syncVisualViewport, { passive:true });
  viewport?.addEventListener('scroll', syncVisualViewport, { passive:true });

  // 公共错误态：记住最近一次原始提交，并把“重试”绑定回产生错误的原业务操作。
  const retryConfigs = [
    {
      form:'script-form', input:'script-input', messages:'script-messages',
      retryOperation:(value) => typeof runScriptRewrite === 'function' ? runScriptRewrite(value) : null,
    },
    {
      form:'xhs-form', input:'xhs-input', messages:'xhs-messages',
      retryOperation:(value) => typeof runXhsFormat === 'function' ? runXhsFormat(value) : null,
    },
  ];

  retryConfigs.forEach((cfg) => {
    const form = document.getElementById(cfg.form);
    const input = document.getElementById(cfg.input);
    const messages = document.getElementById(cfg.messages);
    if (!form || !input || !messages) return;

    let lastSubmitted = '';
    form.addEventListener('submit', () => {
      const value = input.value.trim();
      if (value) lastSubmitted = value;
    }, true);

    function upgradeErrors() {
      messages.querySelectorAll('.message').forEach((message) => {
        if (!/失败[:：]/.test(message.textContent || '') || message.dataset.retryHandled === '1' || message.querySelector('.feedback-retry')) return;
        message.classList.add('feedback-error');
        if (!lastSubmitted) return;
        const actions = document.createElement('div');
        actions.className = 'feedback-actions';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'secondary-button feedback-retry';
        retry.textContent = '重试';
        retry.addEventListener('click', () => {
          if (retry.disabled) return;
          message.dataset.retryHandled = '1';
          retry.disabled = true;
          retry.textContent = '正在重试…';
          const operation = cfg.retryOperation(lastSubmitted);
          if (operation && typeof operation.finally === 'function') {
            operation.finally(() => actions.remove());
          } else {
            actions.remove();
          }
        });
        actions.appendChild(retry);
        message.appendChild(actions);
      });
    }

    new MutationObserver(upgradeErrors).observe(messages, { childList:true, subtree:true, characterData:true });
    upgradeErrors();
  });
})();
