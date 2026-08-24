// 统一多选提交控制器：QuickChoices 只负责选择，Composer 的“发送”是唯一提交入口。
// 业务选择状态以 app.js 中的 state/planningState 为唯一真源。
// 桌面端规则：点击任何多选标签都不能抢走 Composer 输入框焦点；选完后可直接 Enter 提交。
// 触屏端规则：点标签不主动 focus，避免拉起软键盘。
(function () {
  const finePointer = () => window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches;

  function keepComposerKeyboardReady(replies, input) {
    if (!replies || !input) return;
    let lastQuestionSignature = '';

    // 根因修复：选项会被 setChips() 整块重建，逐按钮绑定 pointerdown 存在时间窗。
    // 改为容器 capture 委托，新生成的按钮在任何其他监听器之前就阻止默认聚焦。
    replies.addEventListener('pointerdown', (event) => {
      const button = event.target.closest('button');
      if (!button || button.classList.contains('multi-confirm')) return;
      if (replies.querySelector('.multi-confirm')) event.preventDefault();
    }, true);

    replies.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button || button.classList.contains('multi-confirm') || !replies.querySelector('.multi-confirm')) return;
      if (finePointer()) requestAnimationFrame(() => input.focus({ preventScroll:true }));
    }, true);

    const sync = () => {
      const confirm = replies.querySelector('.multi-confirm');
      if (!confirm) { lastQuestionSignature = ''; return; }
      const signature = [...replies.querySelectorAll('button')]
        .filter((button) => !button.classList.contains('multi-confirm'))
        .map((button) => String(button.dataset.v3Option || button.textContent || '').trim())
        .filter(Boolean).join('|');
      if (!signature || signature === lastQuestionSignature) return;
      lastQuestionSignature = signature;
      if (finePointer()) requestAnimationFrame(() => input.focus({ preventScroll:true }));
    };

    new MutationObserver(sync).observe(replies, { childList:true, subtree:true });
    sync();
  }

  function bindIpComposer() {
    const form=document.getElementById('chat-form'),input=document.getElementById('chat-input'),replies=document.getElementById('quick-replies');
    if(!form||!input)return;keepComposerKeyboardReady(replies,input);
    form.addEventListener('submit',(event)=>{
      const question=typeof questions!=='undefined'?questions[state.currentQuestion]:null;if(!question?.multiple||state.done)return;
      event.preventDefault();event.stopImmediatePropagation();const freeText=input.value.trim();if(freeText)state.multiSelection.add(freeText);input.value='';if(!state.multiSelection.size)return;confirmMultiOption();
    },true);
  }
  function bindPlanningComposer() {
    const form=document.getElementById('planning-form'),input=document.getElementById('planning-input'),replies=document.getElementById('planning-quick-replies');
    if(!form||!input)return;keepComposerKeyboardReady(replies,input);
    form.addEventListener('submit',(event)=>{
      const question=typeof planningQuestions!=='undefined'?planningQuestions[planningState.currentQuestion]:null;if(!question?.multiple||planningState.done)return;
      event.preventDefault();event.stopImmediatePropagation();const freeText=input.value.trim();if(freeText)planningState.multiSelection.add(freeText);input.value='';if(!planningState.multiSelection.size)return;confirmPlanningMulti(question);
    },true);
  }
  bindIpComposer();bindPlanningComposer();
})();
