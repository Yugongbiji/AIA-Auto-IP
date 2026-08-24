// 产品规则 V19：昵称必须有且只能有一个称呼主体；身边人高频真实称呼优先，姓名兜底。
(function () {
  function clean(value) { return String(value || '').trim(); }
  function peerNicknameCandidates(profile) {
    const items = profile?.peerReviewSummary?.topNicknames;
    if (!Array.isArray(items)) return [];
    return items.map((item) => ({ label: clean(item?.label), count: Number(item?.count || 0) })).filter((item) => item.label && !/^(昵称|无|没有|不知道|不清楚|测试)$/i.test(item.label)).sort((a, b) => b.count - a.count).map((item) => item.label);
  }
  function preferredAddress(profile) { const peers = peerNicknameCandidates(profile); if (peers.length) return { value: peers[0], source: '身边人高频称呼', alternatives: peers.slice(1, 3) }; const name = clean(profile?.name); if (name) return { value: name, source: '本人姓名', alternatives: [] }; return { value: '', source: '', alternatives: [] }; }
  function naturalNameAddresses(profile) { const name = clean(profile?.name); const result = []; if (!name) return result; result.push(name); if (name.length >= 2) { const given = name.slice(1); const last = name.slice(-1); if (given) result.push(given); if (last) ['阿', '小', ''].forEach((prefix) => ['', '哥', '姐', '老师', '总'].forEach((suffix) => result.push(`${prefix}${last}${suffix}`))); } return [...new Set(result.filter(Boolean))]; }
  function addressCandidates(profile, preferred) { return [...new Set([preferred.value, ...(preferred.alternatives || []), ...peerNicknameCandidates(profile), clean(profile?.preferredName), ...naturalNameAddresses(profile)].filter(Boolean))].sort((a, b) => b.length - a.length); }
  function existingAddress(nickname, profile, preferred) { const value = clean(nickname); return addressCandidates(profile, preferred).find((candidate) => candidate && value.includes(candidate)) || ''; }
  function keepSingleAddress(nickname, profile, preferred) { let value = clean(nickname); if (!value) return value; const matched = addressCandidates(profile, preferred).filter((candidate) => candidate && value.includes(candidate)); if (matched.length <= 1) return value; const keep = matched.slice().sort((a, b) => value.indexOf(a) - value.indexOf(b) || b.length - a.length)[0]; matched.filter((candidate) => candidate !== keep && !keep.includes(candidate)).forEach((candidate) => { value = value.replaceAll(candidate, ''); }); return value.replace(/\s{2,}/g, ' ').replace(/([·｜|])\1+/g, '$1').trim(); }
  function attachAddress(nickname, address) { const value = clean(nickname); if (!address) return value; if (!value) return address; return `${address}${value}`; }
  function normalizeNicknameOptions(proposal, profile) {
    const options = proposal?.nicknameOptions; if (!Array.isArray(options)) return proposal;
    const preferred = preferredAddress(profile || {}); if (!preferred.value) return proposal;
    options.forEach((option) => {
      if (!option || typeof option !== 'object') return;
      let name = keepSingleAddress(clean(option.name), profile || {}, preferred);
      if (!existingAddress(name, profile || {}, preferred)) name = attachAddress(name, preferred.value);
      name = keepSingleAddress(name, profile || {}, preferred);
      option.name = name; option.addressSource = preferred.source;
      if (!clean(option.reason)) option.reason = preferred.source === '身边人高频称呼' ? '优先使用大家真实、稳定的日常称呼' : '保留真实姓名主体，识别更稳定';
    });
    proposal.nicknameAddress = preferred; return proposal;
  }
  if (typeof renderProposal === 'function') { const baseRenderProposalV19 = renderProposal; renderProposal = function renderProposalV19(proposal, version) { normalizeNicknameOptions(proposal, state.profile || {}); return baseRenderProposalV19(proposal, version); }; }
  window.normalizeNicknameOptionsV19 = normalizeNicknameOptions; window.preferredIpAddressV19 = preferredAddress;
})();
