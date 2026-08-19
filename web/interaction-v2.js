// 通用交互 V3：快捷选项只负责填充答案；统一由底部“发送”提交。
// 选项点击不得主动聚焦输入框；已选标签真正嵌入同一个输入容器；所有聊天功能统一自动跟随。
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
          selected.delete(value);
          renderTray();
          syncOptionButtons();
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
      replies.querySelectorAll('button').forEach((original) => {
        const text = original.textContent.trim();
        if (!text || original.classList.contains('multi-confirm')) return;
        if (original.dataset.v3Ready === '1') return;

        const button = original.cloneNode(true);
        button.dataset.v3Ready = '1';
        button.dataset.v3Option = text;
        button.classList.remove('selected');
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('pointerdown', (event) => event.preventDefault());
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          // “其他”不再主动拉起键盘；用户只有点输入框本身才进入文字输入。
          if (isOtherLabel(text)) return;
          if (selected.has(text)) selected.delete(text);
          else selected.add(text);
          renderTray();
          syncOptionButtons();
        });
        original.replaceWith(button);
      });
      syncOptionButtons();
    }

    new MutationObserver(upgradeMultiChoices).observe(replies, { childList:true, subtree:true });
    ensureEditor();
    upgradeMultiChoices();

    form.addEventListener('submit', () => {
      if (!selected.size) return;
      const freeText = input.value.trim();
      const optionText = Array.from(selected).join('、');
      input.value = freeText ? `${optionText}；${freeText}` : optionText;
      setTimeout(() => {
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

    latest.addEventListener('click', () => scrollToLatest('smooth'));

    ['wheel','touchstart','pointerdown'].forEach((eventName) => {
      messages.addEventListener(eventName, () => { userScrollIntent = true; }, { passive:true });
    });
    messages.addEventListener('scroll', () => {
      if (!userScrollIntent) return;
      setReadingHistory(distanceFromBottom() > 100);
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => { userScrollIntent = false; }, 120);
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

    // 首次进入或切换到已有内容的功能时，也把当前位置校正到最新。
    setTimeout(() => {
      if (!panel.classList.contains('hidden')) scrollToLatest('auto');
    }, 60);
  });
})();
