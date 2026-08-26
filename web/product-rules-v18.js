// 产品规则 V18：资料修改直接保存，不再二次确认；需要时再统一生成新方案。
(function () {
  'use strict';
  if (typeof answer !== 'function') return;
  const baseAnswerV18 = answer;

  function wantsGenerate(text) {
    const compact = String(text || '').replace(/\s+/g, '');
    return /(?:生成|重新生成|出|做).{0,8}(?:新|最新|一版|我的)?(?:IP)?(?:方案|人设)|(?:方案|人设).{0,8}(?:生成|重新生成|出|做)/.test(compact);
  }
  function cleanValue(value){return String(value||'').trim().replace(/[。！!]+$/,'');}
  function parseExtendedRevision(text) {
    const updates = {};
    const rules = [
      ['previousCareer',/(?:过往职业|过去工作|职业经历)(?:改为|改成|是|：|:|加上|增加)?\s*([^，。；;]+)/],
      ['lifeRoles',/(?:家庭身份|生活身份|长期身份)(?:改为|改成|是|：|:|加上|增加)?\s*([^，。；;]+)/],
      ['hobbies',/(?:爱好|兴趣)(?:改为|改成|是|：|:|加上|增加)?\s*([^，。；;]+)/],
      ['services',/(?:可提供服务|服务方向|擅长服务)(?:改为|改成|是|：|:|加上|增加)?\s*([^，。；;]+)/],
    ];
    rules.forEach(([key,pattern])=>{const match=String(text||'').match(pattern);if(match&&cleanValue(match[1]))updates[key]=cleanValue(match[1]);});
    if(/(?:目标|自媒体目的).{0,8}(?:改成|改为|换成|调整为).{0,4}增员|改做增员/.test(text)) updates.primaryGoal='recruitment';
    if(/(?:目标|自媒体目的).{0,8}(?:改成|改为|换成|调整为).{0,4}(?:拓客|获客)|改做拓客/.test(text)) updates.primaryGoal='customer_acquisition';
    return updates;
  }

  function updateSummary(updates) {
    const parts = Object.entries(updates || {}).map(([key, value]) => `${labels[key] || key}已改为“${value}”`);
    return parts.length ? `好的，${parts.join('；')}。` : '好的，资料已经按你的要求更新。';
  }

  async function applyUpdatesDirectly(updates, originalText) {
    const normalized={...(updates||{})};
    if(normalized.primaryGoal) window.aiaIpPolicy?.applyPrimaryGoal?.(state.profile,normalized.primaryGoal);
    Object.entries(normalized).forEach(([key,value])=>{if(key!=='primaryGoal')state.profile[key]=value;});
    window.aiaIpPolicy?.prepareProfileGoal?.(state.profile);
    (state.proposals||[]).forEach(entry=>window.aiaIpPolicy?.enforceProposal?.(entry?.proposal,state.profile));
    window.aiaScriptRecommendation?.reset?.();
    renderProfile();
    await persistMatchedProfile();
    addMessage(`${updateSummary(normalized)}还有其他资料要修改，可以继续告诉我；如果都改好了，回复“生成新方案”，我会根据最新资料重新生成。`, 'assistant');
    if (wantsGenerate(originalText)) await generateProposal();
  }

  answer = async function answerV18(value) {
    const content = String(value || '').trim();
    if (!content) return;
    if (!state.done) return baseAnswerV18(value);

    addMessage(content, 'user');
    if (wantsGenerate(content) && !/(?:改|修改|更新|变成|换成|改成|补充|增加|删除|去掉)/.test(content)) return generateProposal();

    document.getElementById('save-state').textContent = '正在更新资料…';
    try {
      const extended=parseExtendedRevision(content);
      if(Object.keys(extended).length) return await applyUpdatesDirectly(extended,content);
      const result = await understandFollowUp(content);
      const updates = result.updates || {};
      if (Object.keys(updates).length) return await applyUpdatesDirectly(updates, content);
      const fallback = {...parseRevision(content),...parseExtendedRevision(content)};
      if (Object.keys(fallback).length) return await applyUpdatesDirectly(fallback, content);
      addMessage(result.reply || '我还没有识别出需要修改的具体资料。可以直接说“学历改成硕士”“爱好增加骑行”“目标改成增员”这类明确修改。', 'assistant');
    } catch (_) {
      const fallback = {...parseRevision(content),...parseExtendedRevision(content)};
      if (Object.keys(fallback).length) return await applyUpdatesDirectly(fallback, content);
      addMessage('我还没有识别出具体要修改哪项资料。可以直接告诉我，例如“爱好增加骑行”。', 'assistant');
    } finally {
      document.getElementById('save-state').textContent = state.matched ? '已保存到历史档案' : '本次会话';
    }
  };
})();
