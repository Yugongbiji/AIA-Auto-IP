// 产品规则 V19（昵称资料辅助层）：只负责计算优先称呼候选。
// 最终昵称选项只允许 nickname-policy-v1.js 写入，避免多个 renderProposal 包装器重复改 nicknameOptions。
(function () {
  'use strict';
  function clean(value) { return String(value || '').trim(); }
  function peerNicknameCandidates(profile) {
    const items = profile?.peerReviewSummary?.topNicknames;
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => ({ label: clean(item?.label), count: Number(item?.count || 0) }))
      .filter((item) => item.label && !/^(昵称|无|没有|暂无|不知道|不清楚|测试)$/i.test(item.label))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'))
      .map((item) => item.label);
  }
  function naturalNameAddresses(profile) {
    const name = clean(profile?.name); const result = [];
    if (!name) return result;
    result.push(name);
    if (name.length >= 2) {
      const given = name.slice(1), last = name.slice(-1);
      if (given) result.push(given);
      ['', '阿', '小'].forEach((prefix) => ['', '哥', '姐', '老师', '总'].forEach((suffix) => result.push(`${prefix}${last}${suffix}`)));
    }
    return [...new Set(result.filter(Boolean))];
  }
  function preferredAddress(profile) {
    const peers = peerNicknameCandidates(profile);
    if (peers.length) return { value: peers[0], source: '客户反馈高频称呼', alternatives: peers.slice(1, 3) };
    const preferred = clean(profile?.preferredName);
    if (preferred && !/^(无|没有|暂无)$/i.test(preferred)) return { value: preferred, source: '本人填写称呼', alternatives: [] };
    const names = naturalNameAddresses(profile);
    return names.length ? { value: names[0], source: '本人姓名', alternatives: names.slice(1, 4) } : { value: '', source: '', alternatives: [] };
  }
  window.preferredIpAddressV19 = preferredAddress;
  window.aiaNicknameAddressV19 = Object.freeze({ peerNicknameCandidates, naturalNameAddresses, preferredAddress, ownsNicknameOptions:false });
})();
