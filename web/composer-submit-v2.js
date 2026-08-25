// 统一多选提交控制器：QuickChoices 只负责选择，Composer 的“发送”是唯一提交入口。
// 业务选择状态以 app.js 中的 state/planningState 为唯一真源。
// 桌面端选完标签可直接 Enter；触屏端点标签不主动 focus，避免拉起软键盘。
(function () {
  const finePointer = () => window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches;

  function keepComposerKeyboardReady(replies, input, currentQuestion) {
    if (!replies || !input) return;
    let lastQuestionSignature = '';
    const multiActive = () => Boolean(currentQuestion?.()?.multiple);

    // 选项会被 setChips() 整块重建，因此使用容器 capture 委托。
    replies.addEventListener('pointerdown', (event) => {
      const button = event.target.closest('button');
      if (!button || !multiActive()) return;
      event.preventDefault();
    }, true);

    replies.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button || !multiActive()) return;
      // 桌面端保持键盘提交连续性；触屏端绝不主动拉起软键盘。
      if (finePointer()) requestAnimationFrame(() => input.focus({ preventScroll:true }));
    }, true);

    const sync = () => {
      if (!multiActive()) { lastQuestionSignature = ''; return; }
      const signature = [...replies.querySelectorAll('button')]
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
    if(!form||!input)return;
    const currentQuestion=()=>typeof questions!=='undefined'?questions[state.currentQuestion]:null;
    keepComposerKeyboardReady(replies,input,currentQuestion);
    form.addEventListener('submit',(event)=>{
      const question=currentQuestion();if(!question?.multiple||state.done)return;
      event.preventDefault();event.stopImmediatePropagation();
      const freeText=input.value.trim();if(freeText)state.multiSelection.add(freeText);input.value='';
      if(!state.multiSelection.size)return;
      confirmMultiOption();
    },true);
  }

  function bindPlanningComposer() {
    const form=document.getElementById('planning-form'),input=document.getElementById('planning-input'),replies=document.getElementById('planning-quick-replies');
    if(!form||!input)return;
    const currentQuestion=()=>typeof planningQuestions!=='undefined'?planningQuestions[planningState.currentQuestion]:null;
    keepComposerKeyboardReady(replies,input,currentQuestion);
    form.addEventListener('submit',(event)=>{
      const question=currentQuestion();if(!question?.multiple||planningState.done)return;
      event.preventDefault();event.stopImmediatePropagation();
      const freeText=input.value.trim();if(freeText)planningState.multiSelection.add(freeText);input.value='';
      if(!planningState.multiSelection.size)return;
      confirmPlanningMulti(question);
    },true);
  }

  bindIpComposer();
  bindPlanningComposer();
})();
