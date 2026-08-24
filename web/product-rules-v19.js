// 产品规则 V19：昵称必须有称呼；身边人高频真实称呼优先，姓名兜底。
(function () {
  function clean(value) { return String(value || '').trim(); }

  function peerNicknameCandidates(profile) {
    const items = profile?.peerReviewSummary?.topNicknames;
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => ({ label: clean(item?.label), count: Number(item?.count || 0) }))
      .filter((item) => item.label && !/^(昵称|无|没有|不知道|不清楚|测试)$/i.test(item.label))
      .sort((a, b) => b.count - a.count)
      .map((item) => item.label);
  }

  function preferredAddress(profile) {
    const peers = peerNicknameCandidates(profile);
    if (peers.length) return { value: peers[0], source: '身边人高频称呼', alternatives: peers.slice(1, 3) };
    const name = clean(profile?.name);
    if (name) return { value: name, source: '本人姓名', alternatives: [] };
    return { value: '', source: '', alternatives: [] };
  }

  function hasHumanAddress(nickname, profile, preferred) {
    const text = clean(nickname);
    if (!text) return false;
    const candidates = [preferred.value, ...(preferred.alternatives || []), clean(profile?.name)].filter(Boolean);
    if (candidates.some((value) => text.includes(value))) return true;
    // 允许模型基于真实姓名生成自然中文称呼，如“涛哥 / 阿涛 / 小雨”；但禁止纯地域、荣誉或专业标签。
    const name = clean(profile?.name);
    if (name && name.length >= 2) {
      const given = name.slice(1);
      if (given && text.includes(given)) return true;
      const last = name.slice(-1);
      if (last && new RegExp(`(?:阿|小)?${last}(?:哥|姐|老师|总)?`).test(text)) return true;
    }
    return false;
  }

  function attachAddress(nickname, address) {
    const text = clean(nickname);
    if (!address) return text;
    if (!text) return address;
    // “成都”这类标签退化结果变成“成都涛哥”；完整方案也统一补上人的主体。
    return `${text}${address}`;
  }

  function normalizeNicknameOptions(proposal, profile) {
    const options = proposal?.nicknameOptions;
    if (!Array.isArray(options)) return proposal;
    const preferred = preferredAddress(profile || {});
    if (!preferred.value) return proposal;

    options.forEach((option, index) => {
      if (!option || typeof option !== 'object') return;
      let name = clean(option.name);
      if (!hasHumanAddress(name, profile || {}, preferred)) name = attachAddress(name, preferred.value);
      // 第一推荐必须直接采用最高优先级真实称呼作为主体，避免 AI 绕过客户反馈。
      if (index === 0 && peerNicknameCandidates(profile || {}).length && !name.includes(preferred.value)) {
        name = attachAddress(clean(option.name), preferred.value);
      }
      option.name = name;
      option.addressSource = preferred.source;
      if (!clean(option.reason)) option.reason = preferred.source === '身边人高频称呼' ? '优先使用大家最常叫你的真实称呼' : '保留真实姓名，识别更稳定';
    });
    proposal.nicknameAddress = preferred;
    return proposal;
  }

  if (typeof renderProposal === 'function') {
    const baseRenderProposalV19 = renderProposal;
    renderProposal = function renderProposalV19(proposal, version) {
      normalizeNicknameOptions(proposal, state.profile || {});
      return baseRenderProposalV19(proposal, version);
    };
  }

  window.normalizeNicknameOptionsV19 = normalizeNicknameOptions;
  window.preferredIpAddressV19 = preferredAddress;
})();
