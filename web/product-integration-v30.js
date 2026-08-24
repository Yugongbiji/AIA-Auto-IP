// V30 最终产品集成层：只处理“最终页面应该长什么样”，必须最后加载。
(function () {
  function text(value) { return String(value ?? '').trim(); }
  function uniq(values) { return [...new Set((values || []).filter(Boolean))]; }

  function applySemanticUpdates(profile, updates) {
    Object.entries(updates || {}).forEach(([key, value]) => {
      if (!text(profile[key]) && text(value)) profile[key] = text(value);
    });
    return profile;
  }

  async function enrichProfileBeforeWorkspace(profile) {
    if (!profile || profile.__semanticAnalyzed || !text(profile.selfIntro)) return profile;
    profile.__semanticAnalyzed = true;
    try {
      const response = await fetch('/api/profile/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile })
      });
      const result = await response.json();
      if (response.ok) applySemanticUpdates(profile, result.updates || {});
    } catch (_) {
      window.aiaProfileRulesV27?.extractFactsFromIntro?.(profile);
    }
    return profile;
  }

  function relabelFloatingActions() {
    const profileButton = document.querySelector('.ip-floating-profile-button');
    const proposalButton = document.querySelector('.ip-floating-proposal-button');
    const set = (button, top, bottom, aria) => {
      if (!button) return;
      button.innerHTML = `<span>${top}</span><span>${bottom}</span>`;
      button.classList.add('aia-two-line-float');
      button.setAttribute('aria-label', aria);
      button.setAttribute('title', aria);
    };
    set(profileButton, '我的', '资料', '我的资料');
    if (proposalButton && !/V\d+/.test(text(proposalButton.textContent))) set(proposalButton, 'IP', '方案', 'IP方案');
    else if (proposalButton) {
      const version = text(proposalButton.textContent).match(/V\d+/)?.[0] || '';
      proposalButton.innerHTML = `<span>IP</span><span>方案${version ? ` · ${version}` : ''}</span>`;
      proposalButton.classList.add('aia-two-line-float');
    }
  }

  function nicknameAnchors(profile) {
    const values = [];
    if (text(profile.preferredName)) values.push(text(profile.preferredName));
    (profile.peerReviewSummary?.topNicknames || []).forEach((item) => { if (text(item?.label)) values.push(text(item.label)); });
    const name = text(profile.name);
    if (name) { values.push(name); if (name.length >= 2) values.push(name.slice(1)); }
    return uniq(values).filter((v) => v.length >= 1);
  }

  function distinctiveAssets(profile) {
    const assets = [];
    const edu = [profile.education, profile.schoolTier, profile.overseas].filter(Boolean).join(' ');
    if (/博士|硕士|985|211|QS|留学|海外/.test(edu)) assets.push({ key:'学历', label:'学历/学校背景突出', patterns:/博士|硕士|985|211|QS|留学|海外/ });
    const honors = text(profile.honors);
    if (/MDRT|COT|TOT|五星/.test(honors)) assets.push({ key:'荣誉', label:'专业荣誉突出', patterns:/MDRT|COT|TOT|五星/i });
    const city = text(profile.city);
    if (city) assets.push({ key:'地域', label:`地域特色（${city}）`, patterns:new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
    const career = text(profile.previousCareer);
    if (career) assets.push({ key:'经历', label:`过往职业/经历（${career.split(/[｜、]/)[0]}）`, patterns:new RegExp(career.split(/[｜、]/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
    return assets;
  }

  function evaluateExistingNickname(name, profile) {
    const value = text(name); const hardIssues = []; const observations = []; const strengths = [];
    if (!value) return { name:value, hardIssues:['没有填写昵称'], observations, strengths, recommendation:'暂无昵称' };
    if (value.length <= 10) strengths.push('长度比较利落，容易记');
    else if (value.length > 16) hardIssues.push('昵称比较长，用户不容易一次记住');
    if (/友邦|\bAIA\b/i.test(value)) hardIssues.push('包含品牌词，作为个人跨平台长期昵称存在合规和稳定性风险');
    if (/[©®™]|https?:\/\/|www\.|微信|vx|V信|电话|手机号/i.test(value)) hardIssues.push('包含联系方式、链接或导流信息，不适合放在昵称里');

    const matched = nicknameAnchors(profile).filter((a) => a && value.includes(a));
    const distinct = uniq(matched.filter((a) => a.length > 1));
    if (distinct.length > 1) hardIssues.push('一个昵称里出现了两个不同称呼，容易让人误以为是两个名字拼在一起');
    else if (matched.length) strengths.push('有稳定的人物称呼，容易形成“这个账号是谁”的记忆');
    else observations.push('人物称呼不明显，但如果这个昵称已经长期使用、已有客户记忆或对你有特殊意义，不建议仅因此修改');

    const assets = distinctiveAssets(profile);
    const used = assets.filter((asset) => asset.patterns.test(value));
    if (used.length) strengths.push(`已经体现你的特色：${used.map((a) => a.label).join('、')}`);
    else if (assets.length) observations.push(`没有突出可用的个人特色（如${assets.slice(0,2).map((a) => a.label).join('、')}）；这只是可优化方向，不代表现有昵称不好`);

    let recommendation = '建议保留';
    if (hardIssues.length) recommendation = '建议认真考虑调整';
    else if (!strengths.length) recommendation = '建议结合既有使用历史再判断，不宜贸然修改';
    return { name:value, hardIssues, observations, strengths, recommendation };
  }

  function findNicknameTarget(content) {
    const heading = [...content.querySelectorAll('h2,h3,strong')].find((node) => /推荐昵称|昵称推荐/.test(text(node.textContent)));
    if (!heading) return null;
    return heading.closest('section,article,.proposal-section,.proposal-card,.proposal-block') || heading.parentElement;
  }

  function renderNicknameAdvice() {
    const content = document.getElementById('proposal-content'); if (!content) return;
    content.querySelectorAll('.nickname-audit-card,.nickname-general-note,.nickname-reference-note').forEach((n) => n.remove());
    const target = findNicknameTarget(content); if (!target) return;
    const video = text(state.profile?.videoNickname); const xhs = text(state.profile?.xiaohongshuNickname);
    if (video || xhs) {
      const card = document.createElement('section'); card.className = 'nickname-audit-card';
      card.append(Object.assign(document.createElement('h3'), { textContent:'现有昵称建议' }));
      const current = document.createElement('p'); current.className = 'nickname-audit-current'; current.textContent = [video && `视频号：${video}`, xhs && `小红书：${xhs}`].filter(Boolean).join('　'); card.appendChild(current);
      if (video && xhs && video !== xhs) { const p = document.createElement('p'); p.textContent = '两个平台现在使用的昵称不一致。为了长期积累同一个 IP 认知，建议优先考虑统一；但如果两个账号已有明显历史沉淀，也应先评估改名成本。'; card.appendChild(p); }
      uniq([video, xhs]).filter(Boolean).forEach((name) => {
        const result = evaluateExistingNickname(name, state.profile || {});
        const box = document.createElement('div'); box.className = 'nickname-existing-item';
        const title = document.createElement('strong'); title.textContent = `“${name}”——${result.recommendation}`; box.appendChild(title);
        const reasons = [...result.hardIssues, ...result.strengths, ...result.observations];
        if (reasons.length) { const ol = document.createElement('ol'); reasons.forEach((reason) => { const li = document.createElement('li'); li.textContent = reason; ol.appendChild(li); }); box.appendChild(ol); }
        card.appendChild(box);
      });
      target.parentNode.insertBefore(card, target);
    }
    const note = document.createElement('p'); note.className = 'nickname-general-note'; note.textContent = '推荐昵称会综合人物称呼、好记程度、跨平台一致性，以及学历、荣誉、地域、过往职业等真实特色来判断，但不会为了“标准化”而强行塞满标签。';
    target.appendChild(note);
    const reference = document.createElement('p'); reference.className = 'nickname-reference-note'; reference.textContent = 'AI 推荐昵称仅供参考。标准化的推荐不一定最能代表你；如果一个昵称是你最喜欢的、对你有特殊含义，而且愿意长期使用，它往往就是更好的昵称。';
    target.appendChild(reference);
  }

  const baseStartWorkspace = startWorkspace;
  startWorkspace = function integratedStartWorkspace(profile, ...rest) {
    enrichProfileBeforeWorkspace(profile).then((enriched) => baseStartWorkspace(enriched, ...rest));
  };

  const baseRenderProposal = renderProposal;
  renderProposal = function integratedRenderProposal(proposal, version) {
    const result = baseRenderProposal(proposal, version);
    requestAnimationFrame(() => requestAnimationFrame(renderNicknameAdvice));
    return result;
  };

  new MutationObserver(relabelFloatingActions).observe(document.body, { childList:true, subtree:true });
  relabelFloatingActions();

  if (!document.getElementById('product-integration-v30-style')) {
    const style = document.createElement('style'); style.id = 'product-integration-v30-style';
    style.textContent = `.aia-two-line-float{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:2px!important;line-height:1.05!important;text-align:center!important}.aia-two-line-float span{display:block;font-weight:700}.nickname-existing-item{margin-top:12px;padding-top:12px;border-top:1px solid #eee}.nickname-existing-item ol{margin:8px 0 0 20px;padding:0;line-height:1.65}.nickname-reference-note{margin:10px 0 0;padding:11px 12px;border-radius:10px;background:#fff8e8;color:#66552d;font-size:13px;line-height:1.65}`;
    document.head.appendChild(style);
  }

  window.aiaProductIntegrationV30 = { applySemanticUpdates, enrichProfileBeforeWorkspace, relabelFloatingActions, evaluateExistingNickname, distinctiveAssets, renderNicknameAdvice };
})();
