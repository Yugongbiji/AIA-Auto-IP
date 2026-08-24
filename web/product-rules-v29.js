// 产品规则 V29：在最终渲染层收口客户反馈与昵称判断，避免后加载脚本覆盖。
(function () {
  function text(value) { return String(value ?? '').trim(); }
  function uniq(values) { return [...new Set((values || []).filter(Boolean))]; }
  function normalizeItems(items) {
    const map = new Map();
    (items || []).forEach((item) => {
      const label = text(item?.label ?? item); if (!label) return;
      const count = Math.max(1, Number(item?.count || 1) || 1);
      map.set(label, (map.get(label) || 0) + count);
    });
    return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'));
  }
  function feedbackChips(items) {
    const wrap = document.createElement('div'); wrap.className = 'peer-feedback-chips';
    normalizeItems(items).forEach(({ label, count }) => { const chip = document.createElement('span'); chip.className = 'peer-feedback-chip'; chip.textContent = count > 1 ? `${label} ×${count}` : label; wrap.appendChild(chip); });
    return wrap;
  }
  function addFeedbackSection(parent, title, items) {
    if (!Array.isArray(items) || !items.length) return;
    const section = document.createElement('section'); section.className = 'peer-feedback-section';
    const h = document.createElement('h4'); h.textContent = title; section.append(h, feedbackChips(items)); parent.appendChild(section);
  }
  function renderStructuredFeedback() {
    const card = document.getElementById('profile-card'); const summary = state.profile?.peerReviewSummary;
    if (!card) return;
    card.querySelector('[data-profile-peer-review="1"]')?.remove();
    card.querySelector('.peer-review-summary')?.remove();
    card.querySelector('[data-peer-feedback="1"]')?.remove();
    if (!summary || !Number(summary.reviewCount || 0)) return;
    const block = document.createElement('div'); block.className = 'profile-group profile-group-full peer-feedback-card'; block.dataset.peerFeedback = '1';
    const head = document.createElement('div'); head.className = 'peer-feedback-head';
    const title = document.createElement('span'); title.className = 'profile-label'; title.textContent = '客户反馈';
    const meta = document.createElement('span'); meta.className = 'peer-feedback-meta'; meta.textContent = `共 ${Number(summary.reviewCount)} 位客户反馈`;
    head.append(title, meta); block.appendChild(head);
    addFeedbackSection(block, '大家怎么称呼我', summary.topNicknames);
    addFeedbackSection(block, '他们和我的关系', summary.relationships || summary.topRelationships);
    addFeedbackSection(block, '他们眼中的我', summary.topTraits);
    addFeedbackSection(block, '他们愿意找我聊什么', summary.topTopics);
    addFeedbackSection(block, '他们觉得我更像哪种人', summary.topRoles);
    const quotes = uniq((summary.representativeQuotes || summary.quotes || []).map((item) => text(item?.label ?? item)));
    if (quotes.length) {
      const section = document.createElement('section'); section.className = 'peer-feedback-section peer-feedback-quotes';
      const h = document.createElement('h4'); h.textContent = '他们怎么向别人介绍我'; section.appendChild(h);
      const list = document.createElement('div'); list.className = 'peer-feedback-quote-list';
      quotes.forEach((quote, index) => { const p = document.createElement('p'); p.textContent = quote; if (index >= 3) p.hidden = true; list.appendChild(p); }); section.appendChild(list);
      if (quotes.length > 3) { const button = document.createElement('button'); button.type = 'button'; button.className = 'text-button peer-feedback-more'; button.textContent = `查看全部 ${quotes.length} 条`; button.onclick = () => { const expanded = button.dataset.expanded === '1'; [...list.children].forEach((node, index) => { if (index >= 3) node.hidden = expanded; }); button.dataset.expanded = expanded ? '0' : '1'; button.textContent = expanded ? `查看全部 ${quotes.length} 条` : '收起'; }; section.appendChild(button); }
      block.appendChild(section);
    }
    const intro = card.querySelector('[data-signup-intro="1"]');
    if (intro) card.insertBefore(block, intro); else card.appendChild(block);
  }

  function knownAddresses(profile) {
    const items = [];
    const preferred = text(profile?.preferredName); if (preferred) items.push(preferred);
    (profile?.peerReviewSummary?.topNicknames || []).forEach((item) => { const label = text(item?.label); if (label) items.push(label); });
    const name = text(profile?.name); if (name) { items.push(name); if (name.length >= 2) items.push(name.slice(1), name.slice(-1)); }
    return uniq(items).filter((item) => item.length >= 1);
  }
  function evaluateNickname(name, profile) {
    const value = text(name); const issues = []; const strengths = [];
    if (!value) return { name:value, issues:['没有填写昵称'], strengths:[], hasPersonAnchor:false };
    if (value.length <= 10) strengths.push('长度比较利落，容易记');
    else if (value.length > 14) issues.push('名字有点长，用户不容易一次记住');
    if (/友邦|\bAIA\b/i.test(value)) issues.push('带有品牌词，不适合作为长期跨平台昵称');
    if (/[©®™]|https?:\/\/|www\.|微信|vx|V信|电话|手机号/i.test(value)) issues.push('带有联系方式、链接或导流信息，不适合放进昵称');
    const matched = knownAddresses(profile).filter((address) => address && value.includes(address));
    const distinct = uniq(matched.filter((a) => a.length > 1));
    if (distinct.length > 1) issues.push('一个昵称里出现了两个称呼，读起来像把两个名字拼在一起');
    const hasPersonAnchor = distinct.length === 1 || matched.length === 1;
    if (hasPersonAnchor) strengths.push('有稳定的人物称呼，别人更容易记住是在关注谁');
    return { name:value, issues, strengths, hasPersonAnchor };
  }
  function auditExistingNicknames(profile) {
    window.aiaProfileRulesV27?.normalizeSignupProfile?.(profile);
    const video = text(profile?.videoNickname); const xhs = text(profile?.xiaohongshuNickname);
    const candidates = uniq([video, xhs]).filter(Boolean).map((name) => evaluateNickname(name, profile));
    const same = !!(video && xhs && video === xhs);
    const good = candidates.filter((item) => !item.issues.length && item.hasPersonAnchor);
    return { video, xhs, same, candidates, preferred: good[0]?.name || '' };
  }
  function nicknamePanelTarget(content) {
    const heading = [...content.querySelectorAll('h2,h3,strong')].find((node) => /推荐昵称|昵称推荐/.test(text(node.textContent)));
    if (!heading) return null;
    return heading.closest('section,article,.proposal-section,.proposal-card,.proposal-block') || heading.parentElement;
  }
  function renderNicknameAuditInPlace() {
    const content = document.getElementById('proposal-content'); if (!content) return;
    content.querySelector('.nickname-audit-card')?.remove(); content.querySelector('.nickname-general-note')?.remove();
    const target = nicknamePanelTarget(content); if (!target) return;
    const audit = auditExistingNicknames(state.profile || {});
    if (audit.video || audit.xhs) {
      const card = document.createElement('section'); card.className = 'nickname-audit-card';
      const h = document.createElement('h3'); h.textContent = '现有昵称建议'; card.appendChild(h);
      const current = document.createElement('p'); current.className = 'nickname-audit-current'; current.textContent = [audit.video && `视频号：${audit.video}`, audit.xhs && `小红书：${audit.xhs}`].filter(Boolean).join('　'); card.appendChild(current);
      if (audit.video && audit.xhs && !audit.same) { const p = document.createElement('p'); p.textContent = '两个平台现在用的昵称不一样。做个人 IP 建议统一成同一个昵称，长期识别会更稳定。'; card.appendChild(p); }
      audit.candidates.forEach((item) => { const p = document.createElement('p'); if (item.issues.length) p.textContent = `“${item.name}”：${item.issues.join('；')}。建议调整。`; else if (item.hasPersonAnchor) p.textContent = `“${item.name}”：整体比较清楚、好记，也能认出是在叫谁。建议优先保留。`; else p.textContent = `“${item.name}”：格式上没有明显问题，但人物识别度一般。是否保留要结合这个名字是否已经长期使用、用户是否已经形成记忆。`; card.appendChild(p); });
      target.parentNode.insertBefore(card, target);
    }
    const note = document.createElement('p'); note.className = 'nickname-general-note'; note.textContent = '昵称原则：最好有一个稳定的人物称呼或名字线索；一个昵称只保留一个称呼主体；不同平台尽量统一；确定后不要频繁改名。';
    const heading = [...target.querySelectorAll('h2,h3,strong')].find((node) => /推荐昵称|昵称推荐/.test(text(node.textContent)));
    (heading?.parentElement || target).appendChild(note);
  }

  const baseRenderProfile = renderProfile;
  renderProfile = function renderProfileV29() { const result = baseRenderProfile(); requestAnimationFrame(renderStructuredFeedback); return result; };
  const baseRenderProposal = renderProposal;
  renderProposal = function renderProposalV29(proposal, version) { const result = baseRenderProposal(proposal, version); requestAnimationFrame(() => requestAnimationFrame(renderNicknameAuditInPlace)); return result; };

  if (!document.getElementById('product-rules-v29-style')) { const style = document.createElement('style'); style.id = 'product-rules-v29-style'; style.textContent = `.nickname-general-note{margin:10px 0 0;padding:10px 12px;border-radius:10px;background:#f7f4f5;color:#6a5f63;font-size:13px;line-height:1.6}.peer-feedback-card{grid-column:1/-1!important}`; document.head.appendChild(style); }
  window.aiaProductRulesV29 = { renderStructuredFeedback, evaluateNickname, auditExistingNicknames, renderNicknameAuditInPlace };
})();
