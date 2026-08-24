// 统一多选提交控制器：QuickChoices 只负责选择，Composer 的“发送”是唯一提交入口。
// 业务选择状态以 app.js 中的 state/planningState 为唯一真源；不再通过隐藏的“确认已选”按钮模拟提交。
// 键盘规则：桌面端进入新的多选题时把焦点留在 Composer 输入框；鼠标点标签不抢焦点，
// 因此选择标签后可直接按 Enter 提交。触屏设备不自动 focus，避免误拉起软键盘。
(function () {
  const finePointer = () => window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches;

  function keepComposerKeyboardReady(replies, input) {
    if (!replies || !input) return;
    let lastQuestionSignature = '';

    const sync = () => {
      const confirm = replies.querySelector('.multi-confirm');
      if (!confirm) { lastQuestionSignature = ''; return; }
      const signature = [...replies.querySelectorAll('button')]
        .filter((button) => !button.classList.contains('multi-confirm'))
        .map((button) => String(button.dataset.v3Option || button.textContent || '').trim())
        .filter(Boolean)
        .join('|');
      if (!signature || signature === lastQuestionSignature) return;
      lastQuestionSignature = signature;

      // 只在桌面/鼠标环境自动保留键盘焦点；移动端严格遵守“点标签不弹键盘”。
      if (finePointer()) requestAnimationFrame(() => input.focus({ preventScroll: true }));
    };

    new MutationObserver(sync).observe(replies, { childList: true, subtree: true });
    sync();
  }

  function bindIpComposer() {
    const form = document.getElementById('chat-form');
    const input = document.getElementById('chat-input');
    const replies = document.getElementById('quick-replies');
    if (!form || !input) return;

    keepComposerKeyboardReady(replies, input);

    form.addEventListener('submit', (event) => {
      const question = typeof questions !== 'undefined' ? questions[state.currentQuestion] : null;
      if (!question?.multiple || state.done) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const freeText = input.value.trim();
      if (freeText) state.multiSelection.add(freeText);
      input.value = '';

      if (!state.multiSelection.size) return;
      confirmMultiOption();
    }, true);
  }

  function bindPlanningComposer() {
    const form = document.getElementById('planning-form');
    const input = document.getElementById('planning-input');
    const replies = document.getElementById('planning-quick-replies');
    if (!form || !input) return;

    keepComposerKeyboardReady(replies, input);

    form.addEventListener('submit', (event) => {
      const question = typeof planningQuestions !== 'undefined' ? planningQuestions[planningState.currentQuestion] : null;
      if (!question?.multiple || planningState.done) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const freeText = input.value.trim();
      if (freeText) planningState.multiSelection.add(freeText);
      input.value = '';

      if (!planningState.multiSelection.size) return;
      confirmPlanningMulti(question);
    }, true);
  }

  bindIpComposer();
  bindPlanningComposer();
})();
