// 产品规则 V5（直接进入兼容层）：只负责访客流程中的姓名/营销员编号收集与二次匹配。
// 简介、合规、资料展示、内容方向等已迁移到各自唯一 owner，不再在本文件修改。
(function () {
  'use strict';
  if (!Array.isArray(questions)) return;

  if (!questions.some((item) => item.key === 'name')) {
    questions.unshift(
      { key: 'name', label: '姓名', ask: '先告诉我你的姓名吧。', chips: [] },
      { key: 'agentId', label: '营销员编号', ask: '请输入你的 9 位营销员编号。这个编号只用于匹配已有资料，减少重复填写。', chips: [], inputMode: 'numeric' },
    );
  }

  if (typeof answer === 'function') {
    const baseAnswerV5 = answer;
    answer = async function answerV5(value) {
      const content = String(value || '').trim();
      if (!content) return;
      const question = !state.done ? questions[state.currentQuestion] : null;
      if (question?.key !== 'agentId') return baseAnswerV5(value);
      if (!/^\d{9}$/.test(content)) {
        addMessage('营销员编号应为 9 位数字，请再确认一下后输入。', 'assistant');
        return;
      }
      addMessage(content, 'user');
      state.profile.agentId = content;
      document.getElementById('save-state').textContent = '正在匹配已有资料…';
      try {
        const response = await fetch(`/api/lookup?name=${encodeURIComponent(state.profile.name || '')}&agentId=${encodeURIComponent(content)}`);
        const result = await response.json();
        if (result.matched) {
          addMessage('已经匹配到你的已有资料，接下来只补还缺的部分。', 'system', false);
          return startWorkspace(result.profile, true, result.history || [], result.proposals || [], result.planningHistory || [], result.contentPlans || [], result.creativeHistory || []);
        }
        addMessage('暂时没有匹配到已有资料，我们继续把需要的信息补齐。', 'assistant', false);
      } catch (_) {
        addMessage('这次没有连上资料匹配服务，但不影响继续创建 IP，我们先往下填写。', 'assistant', false);
      }
      state.currentQuestion += 1;
      setChips(null);
      renderProfile();
      presentQuestion();
      document.getElementById('save-state').textContent = '本次会话';
    };
  }

  window.aiaProductRulesV5 = Object.freeze({ compatibilityOnly:true, ownsBio:false, ownsCompliance:false });
})();
