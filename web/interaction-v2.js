// 通用交互 V4：快捷选项只负责填充答案；统一由底部“发送”提交。
// 选项点击不得主动聚焦输入框；已选标签真正嵌入同一个输入容器；所有聊天功能统一自动跟随。
// 同时统一移动端 visualViewport、错误重试与长会话滚动边界。
(function () {
  const configs = [
    { replies:'quick-replies', form:'chat-form', input:'chat-input', messages:'messages', panel:'ip-chat-panel' },
    { replies:'planning-quick-replies', form:'planning-form', input:'planning-input', messages:'planning-messages', panel:'planning-panel' },
  ];

  function isOtherLabel(text) {
    return /^其他(?:$|[：:\s…\.（(])/.test(String(text || '').trim());
  }

  configs.forEach((cfg) => {
    const replies = document.getElementById(cfg.replies);
    const form = document.getElementById(cfg.form);
    const input = document.getElementById(cfg.input);
    if (!replies || !form || !input) return;

    const selected = new Set();
    let editor = null;
    let tray = null;

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
      replies.querySelectorAll('button[data-v3-option]').forEach((button) => {
        const active = selected.has(button.dataset.v3Option);
        button.classList.toggle('selected', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    function renderTray() {
      ensureEditor();
      tray.innerHTML = '';
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
          const option = [...replies.querySelectorAll('button[data-v3-option]')].find((button) => button.dataset.v3Option === value);
          if (option) option.click();
          else {
            selected.delete(value);
            renderTray();
            syncOptionButtons();
          }
        });
        chip.append(label, remove);
        tray.appendChild(chip);
      });
      editor.classList.toggle('has-chips', selected.size > 0);
    }

    function upgradeMultiChoices() {
      const confirm = replies.querySelector('.multi-confirm');
      if (!confirm) {
        selected.clear();
        ensureEditor();
        renderTray();
        replies.classList.remove('quick-replies-v3');
        return;
      }

      ensureEditor();
      replies.classList.add('quick-replies-v3');
      replies.querySelectorAll('.custom-multi-input').forEach((node) => node.remove());
      replies.querySelectorAll('button').forEach((button) => {
        const text = button.textContent.trim();
        if (!text || button.classList.contains('multi-confirm')) return;
        if (button.dataset.v3Ready === '1') return;

        button.dataset.v3Ready = '1';
        button.dataset.v3Option = text;
        button.setAttribute('aria-pressed', selected.has(text) ? 'true' : 'false');
        button.addEventListener('pointerdown', (event) => event.preventDefault());
        button.addEventListener('click', () => {
          if (isOtherLabel(text)) return;
          if (selected.has(text)) selected.delete(text);
          else selected.add(text);
          renderTray();
          requestAnimationFrame(syncOptionButtons);
        });
      });
      syncOptionButtons();
    }

    new MutationObserver(upgradeMultiChoices).observe(replies, { childList:true, subtree:true });
    ensureEditor();
    upgradeMultiChoices();

    form.addEventListener('submit', () => {
      if (!selected.size) return;
      const freeText = input.value.trim();
      input.value = freeText;
      setTimeout(() => {
        const confirm = replies.querySelector('.multi-confirm');
        if (confirm && !confirm.disabled) confirm.click();
        selected.clear();
        renderTray();
        syncOptionButtons();
      }, 0);
    }, true);
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
  // 已点击过重试的历史错误卡片会被标记为 handled，避免 MutationObserver 再次补回按钮。
  // 如果这次重试仍失败，业务层会产生一张新的错误卡片；新卡片仍可正常再次重试。
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
