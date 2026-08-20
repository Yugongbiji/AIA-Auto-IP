// 统一多选提交控制器：QuickChoices 只负责选择，Composer 的“发送”是唯一提交入口。
// 业务选择状态以 app.js 中的 state/planningState 为唯一真源；不再通过隐藏的“确认已选”按钮模拟提交。
(function () {
  function bindIpComposer() {
    const form = document.getElementById('chat-form');
    const input = document.getElementById('chat-input');
    if (!form || !input) return;

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
    if (!form || !input) return;

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
