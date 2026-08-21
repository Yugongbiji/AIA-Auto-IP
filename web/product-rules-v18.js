// 产品规则 V18：资料修改直接保存，不再二次确认；需要时再统一生成新方案。
(function () {
  if (typeof answer !== 'function') return;
  const baseAnswerV18 = answer;

  function wantsGenerate(text) {
    const compact = String(text || '').replace(/\s+/g, '');
    return /(?:生成|重新生成|出|做).{0,8}(?:新|最新|一版|我的)?(?:IP)?(?:方案|人设)|(?:方案|人设).{0,8}(?:生成|重新生成|出|做)/.test(compact);
  }

  function updateSummary(updates) {
    const parts = Object.entries(updates || {}).map(([key, value]) => `${labels[key] || key}已改为“${value}”`);
    return parts.length ? `好的，${parts.join('；')}。` : '好的，资料已经按你的要求更新。';
  }

  async function applyUpdatesDirectly(updates, originalText) {
    Object.assign(state.profile, updates || {});
    renderProfile();
    await persistMatchedProfile();
    addMessage(`${updateSummary(updates)}还有其他资料要修改，可以继续告诉我；如果都改好了，回复“生成新方案”，我会根据最新资料重新生成。`, 'assistant');
    if (wantsGenerate(originalText)) await generateProposal();
  }

  answer = async function answerV18(value) {
    const content = String(value || '').trim();
    if (!content) return;
    if (!state.done) return baseAnswerV18(value);

    addMessage(content, 'user');

    // 纯生成请求不进入资料理解，直接基于当前已保存资料生成。
    if (wantsGenerate(content) && !/(?:改|修改|更新|变成|换成|改成|补充|增加|删除|去掉)/.test(content)) {
      return generateProposal();
    }

    document.getElementById('save-state').textContent = '正在更新资料…';
    try {
      const result = await understandFollowUp(content);
      const updates = result.updates || {};
      if (Object.keys(updates).length) return await applyUpdatesDirectly(updates, content);

      const fallback = parseRevision(content);
      if (Object.keys(fallback).length) return await applyUpdatesDirectly(fallback, content);

      addMessage(result.reply || '我还没有识别出需要修改的具体资料。可以直接说“学历改成硕士”“城市改杭州”这类明确修改。', 'assistant');
    } catch (_) {
      const fallback = parseRevision(content);
      if (Object.keys(fallback).length) return await applyUpdatesDirectly(fallback, content);
      addMessage('我还没有识别出具体要修改哪项资料。可以直接告诉我，例如“学历改成硕士”。', 'assistant');
    } finally {
      document.getElementById('save-state').textContent = state.matched ? '已保存到历史档案' : '本次会话';
    }
  };
})();
