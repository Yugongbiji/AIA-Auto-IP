// 通用交互 V2：多选快捷项只负责填充答案；统一由底部“发送”提交。
// 同时为所有聊天功能加入合理的自动跟随新消息规则。
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
    let tray = null;

    function ensureTray() {
      if (tray && tray.isConnected) return tray;
      tray = document.createElement('div');
      tray.className = 'composer-selection-tray';
      tray.setAttribute('aria-label', '已选择的快捷答案');
      form.classList.add('has-selection-tray');
      form.insertBefore(tray, input);
      return tray;
    }

    function syncOptionButtons() {
      replies.querySelectorAll('button[data-v2-option]').forEach((button) => {
        button.classList.toggle('selected', selected.has(button.dataset.v2Option));
        button.setAttribute('aria-pressed', selected.has(button.dataset.v2Option) ? 'true' : 'false');
      });
    }

    function renderTray() {
      const target = ensureTray();
      target.innerHTML = '';
      selected.forEach((value) => {
        const chip = document.createElement('span');
        chip.className = 'composer-selection-chip';
        const label = document.createElement('span');
        label.textContent = value;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.setAttribute('aria-label', `取消选择 ${value}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => {
          selected.delete(value);
          renderTray();
          syncOptionButtons();
          input.focus();
        });
        chip.append(label, remove);
        target.appendChild(chip);
      });
    }

    function upgradeMultiChoices() {
      const confirm = replies.querySelector('.multi-confirm');
      if (!confirm) {
        selected.clear();
        renderTray();
        replies.classList.remove('quick-replies-v2');
        return;
      }

      replies.classList.add('quick-replies-v2');
      replies.querySelectorAll('.custom-multi-input').forEach((node) => node.remove());
      replies.querySelectorAll('button').forEach((original) => {
        const text = original.textContent.trim();
        if (!text || original.classList.contains('multi-confirm')) return;
        if (original.dataset.v2Ready === '1') return;

        const button = original.cloneNode(true);
        button.dataset.v2Ready = '1';
        button.dataset.v2Option = text;
        button.classList.remove('selected');
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (isOtherLabel(text)) {
            input.focus();
            return;
          }
          if (selected.has(text)) selected.delete(text);
          else selected.add(text);
          renderTray();
          syncOptionButtons();
          input.focus();
        });
        original.replaceWith(button);
      });
      syncOptionButtons();
    }

    new MutationObserver(upgradeMultiChoices).observe(replies, { childList:true, subtree:true });
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

  // 所有聊天区的自动跟随：正常对话始终跟到最新；用户主动上翻历史时不强拉回。
  document.querySelectorAll('.chat-panel').forEach((panel) => {
    const messages = panel.querySelector('.messages');
    const form = panel.querySelector('.composer');
    if (!messages) return;

    let userReadingHistory = false;
    let programmaticScroll = false;
    const latest = document.createElement('button');
    latest.type = 'button';
    latest.className = 'chat-latest-button';
    latest.textContent = '回到最新 ↓';
    panel.appendChild(latest);

    function distanceFromBottom() {
      return messages.scrollHeight - messages.scrollTop - messages.clientHeight;
    }

    function scrollToLatest(behavior = 'smooth') {
      programmaticScroll = true;
      messages.scrollTo({ top:messages.scrollHeight, behavior });
      userReadingHistory = false;
      panel.classList.remove('show-latest-button');
      setTimeout(() => { programmaticScroll = false; }, behavior === 'smooth' ? 350 : 0);
    }

    latest.addEventListener('click', () => scrollToLatest('smooth'));

    messages.addEventListener('scroll', () => {
      if (programmaticScroll) return;
      const away = distanceFromBottom() > 140;
      userReadingHistory = away;
      panel.classList.toggle('show-latest-button', away);
    }, { passive:true });

    new MutationObserver((mutations) => {
      const hasNewContent = mutations.some((mutation) => mutation.addedNodes && mutation.addedNodes.length);
      if (!hasNewContent) return;
      requestAnimationFrame(() => {
        if (userReadingHistory) {
          panel.classList.add('show-latest-button');
        } else {
          scrollToLatest('smooth');
        }
      });
    }).observe(messages, { childList:true, subtree:true });

    if (form) {
      form.addEventListener('submit', () => {
        userReadingHistory = false;
        panel.classList.remove('show-latest-button');
        setTimeout(() => scrollToLatest('smooth'), 20);
      }, true);
    }
  });
})();
