// 产品规则 V10：首次复制昵称/简介提醒修改次数；IP 合规板块默认折叠。
(function () {
  const reminderSeen = { nickname: false, bio: false };

  function setCopiedState(button) {
    const original = button.textContent;
    button.textContent = '已复制';
    setTimeout(() => { button.textContent = original; }, 1200);
  }

  function writeClipboard(text, button) {
    navigator.clipboard?.writeText(text).then(() => setCopiedState(button)).catch(() => {
      button.textContent = '请手动复制';
    });
  }

  function closeReminder(modal) {
    modal?.remove();
    document.body.classList.remove('copy-reminder-open');
  }

  function showFirstCopyReminder(kind, text, button) {
    const modal = document.createElement('div');
    modal.className = 'copy-reminder-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', '发布前修改次数提醒');

    const card = document.createElement('section');
    card.className = 'copy-reminder-modal';
    const title = document.createElement('h3');
    title.textContent = '复制前提醒一下 📌';
    const intro = document.createElement('p');
    intro.textContent = kind === 'nickname'
      ? '昵称可以慢慢选，发布前建议先确认好。部分平台修改次数有限。'
      : '简介复制后可以再检查一遍，部分平台短期内修改次数有限。';

    const list = document.createElement('ul');
    const reminders = kind === 'nickname'
      ? ['微信视频号昵称：每年最多可修改 5 次。', '不同平台规则可能调整，最终以平台当时提示为准。']
      : ['小红书个人简介：7 天内最多修改 3 次，频繁修改也可能影响账号稳定。', '微信视频号简介：目前没有明确的修改次数限制。', '不同平台规则可能调整，最终以平台当时提示为准。'];
    reminders.forEach((line) => { const li = document.createElement('li'); li.textContent = line; list.appendChild(li); });

    const actions = document.createElement('div');
    actions.className = 'copy-reminder-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'secondary-button';
    cancel.textContent = '先不复制';
    cancel.onclick = () => closeReminder(modal);
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'primary';
    confirm.textContent = '知道了，继续复制';
    confirm.onclick = () => {
      reminderSeen[kind] = true;
      writeClipboard(text, button);
      closeReminder(modal);
    };
    actions.append(cancel, confirm);
    card.append(title, intro, list, actions);
    modal.appendChild(card);
    document.body.appendChild(modal);
    document.body.classList.add('copy-reminder-open');
    confirm.focus();

    modal.addEventListener('click', (event) => { if (event.target === modal) closeReminder(modal); });
    modal.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeReminder(modal); });
  }

  function bindCopyReminder(button, kind, text) {
    if (!button || button.dataset.copyReminderBound === '1') return;
    button.dataset.copyReminderBound = '1';
    button.addEventListener('click', (event) => {
      if (reminderSeen[kind]) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      showFirstCopyReminder(kind, text, button);
    }, true);
  }

  function makeComplianceFold(content) {
    const compliance = content.querySelector('.compliance-card');
    const reminders = content.querySelector('.platform-reminders');
    if ((!compliance && !reminders) || content.querySelector('.ip-compliance-fold')) return;

    const details = document.createElement('details');
    details.className = 'ip-compliance-fold';
    const summary = document.createElement('summary');
    summary.innerHTML = '<span>🛡️ 合规与修改提醒</span><small>点击查看</small>';
    details.appendChild(summary);
    if (compliance) details.appendChild(compliance);
    if (reminders) details.appendChild(reminders);
    content.appendChild(details);
  }

  function enhanceProposalCopy(content) {
    content.querySelectorAll('.nickname-option').forEach((row) => {
      const button = row.querySelector('.copy-button');
      const text = row.querySelector('strong')?.textContent?.trim() || '';
      bindCopyReminder(button, 'nickname', text);
    });

    content.querySelectorAll('.bio-copy-block').forEach((block) => {
      const button = block.querySelector('.copy-button');
      const text = block.querySelector('textarea')?.value || '';
      bindCopyReminder(button, 'bio', text);
    });
  }

  if (typeof renderProposal === 'function') {
    const baseRenderProposalV10 = renderProposal;
    renderProposal = function renderProposalV10(proposal, version) {
      const result = baseRenderProposalV10(proposal, version);
      const content = document.getElementById('proposal-content');
      if (content) {
        makeComplianceFold(content);
        enhanceProposalCopy(content);
      }
      return result;
    };
  }
})();
