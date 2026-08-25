// 产品规则 V27：资料标准化 / 自我介绍提取 / 客户反馈与个人介绍展示的唯一 Owner。
// 昵称由 nickname-policy / V29 负责；悬浮按钮由 profile-float 负责。
(function () {
  'use strict';
  let semanticKey='';
  let semanticRunning=false;
  function text(value) { return String(value ?? '').trim(); }
  function splitValues(value) { return text(value).split(/[｜|、,，;；/\n]+/).map((v) => v.trim()).filter(Boolean); }
  function uniq(values) { return [...new Set((values || []).filter(Boolean))]; }
  function firstByKey(profile, patterns) { for (const [key, value] of Object.entries(profile || {})) if (patterns.some((pattern) => pattern.test(key)) && text(value)) return text(value); return ''; }

  function normalizeSignupProfile(profile) {
    if (!profile || typeof profile !== 'object') return profile;
    const fill = (key, patterns) => { if (!text(profile[key])) profile[key] = firstByKey(profile, patterns); };
    fill('selfIntro', [/^自我介绍$/, /简单的自我介绍/, /自媒体.*优势/, /个人介绍/]);
    fill('videoNickname', [/视频号.*昵称/, /微信视频号.*昵称/]);
    fill('xiaohongshuNickname', [/小红书.*昵称/, /小红书号.*昵称/]);
    fill('services', [/擅长领域.*服务/, /可提供服务/, /服务能力/, /擅长.*领域/]);
    fill('previousCareer', [/过往职业/, /过去.*工作/, /职业经历/]);
    fill('lifeRoles', [/家庭.*身份/, /生活身份/]);
    fill('hobbies', [/个人爱好/, /兴趣爱好/, /长期爱好/]);
    return profile;
  }

  const FACT_RULES = {
    previousCareer: [[/教师|老师|教培|教育行业/, '教育/教师'], [/医生|护士|医疗行业/, '医疗健康'], [/律师|法务|法律行业/, '法律'], [/会计|审计|财务|税务/, '财务/会计'], [/互联网|程序员|产品经理|工程师|\bIT\b/i, '互联网/科技'], [/创业|企业经营|经营公司/, '企业经营']],
    lifeRoles: [[/宝妈|孩子的妈妈|两个孩子的妈妈|三个孩子的妈妈/, '宝妈'], [/宝爸|孩子的爸爸|两个孩子的爸爸|三个孩子的爸爸/, '宝爸'], [/创业者|企业主/, '创业者'], [/职场人|上班族/, '职场人']],
    hobbies: [[/骑行|自行车/, '骑行'], [/跑步|马拉松/, '跑步'], [/徒步|露营|登山|户外/, '户外'], [/旅行|旅游/, '旅行'], [/摄影|拍照/, '摄影'], [/读书|阅读/, '读书'], [/美食|烹饪|做饭/, '美食'], [/健身|瑜伽|游泳|羽毛球|网球/, '运动健身']],
  };
  function extractFactsFromIntro(profile) {
    normalizeSignupProfile(profile);
    const intro = text(profile?.selfIntro); if (!intro) return profile;
    Object.entries(FACT_RULES).forEach(([field, rules]) => {
      const found = rules.filter(([pattern]) => pattern.test(intro)).map(([, label]) => label);
      if (found.length) profile[field] = uniq([...splitValues(profile[field]), ...found]).join('｜');
    });
    return profile;
  }

  function currentSemanticKey(profile){return `${text(profile?.primaryGoal)}|${text(profile?.selfIntro)}`;}
  async function semanticEnrich(profile,force=false) {
    normalizeSignupProfile(profile); extractFactsFromIntro(profile);
    const key=currentSemanticKey(profile);
    if (!text(profile?.selfIntro) || semanticRunning || (!force && key===semanticKey)) return {};
    semanticKey=key; semanticRunning=true;
    try {
      const response = await fetch('/api/profile/analyze', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ profile }) });
      if (!response.ok) return {};
      const payload = await response.json(); const updates = payload?.updates && typeof payload.updates === 'object' ? payload.updates : {};
      const applied = {};
      Object.entries(updates).forEach(([key,value]) => { if (!text(profile[key]) && text(value)) { profile[key]=text(value); applied[key]=text(value); } });
      if (Object.keys(applied).length) {
        window.aiaIpPolicy?.prepareProfileGoal?.(profile);
        (state.proposals||[]).forEach(entry=>window.aiaIpPolicy?.enforceProposal?.(entry?.proposal,profile));
        if (state.profile === profile) {
          renderProfile();
          if (state.matched) Promise.resolve(persistMatchedProfile()).catch(()=>{});
          window.aiaScriptRecommendation?.reset?.();
          const currentQuestion=questions?.[state.currentQuestion];
          if(currentQuestion&&text(profile[currentQuestion.key])){state.currentQuestion+=1;setChips(null);presentQuestion();}
        }
      }
      return applied;
    } catch (_) { return {}; }
    finally { semanticRunning=false; }
  }

  function normalizeCountItems(items) {
    const map = new Map();
    (items || []).forEach((item) => { const label = text(item?.label ?? item); if (!label) return; const count = Math.max(1, Number(item?.count || 1) || 1); map.set(label, (map.get(label) || 0) + count); });
    return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'));
  }
  function chipList(items) {
    const wrap = document.createElement('div'); wrap.className = 'peer-feedback-chips';
    normalizeCountItems(items).forEach(({ label, count }) => { const chip = document.createElement('span'); chip.className = 'peer-feedback-chip'; chip.textContent = count > 1 ? `${label} ×${count}` : label; wrap.appendChild(chip); });
    return wrap;
  }
  function feedbackSection(title, items) { const section = document.createElement('section'); section.className = 'peer-feedback-section'; const h = document.createElement('h4'); h.textContent = title; section.append(h, chipList(items)); return section; }
  function renderPeerFeedback() {
    const card = document.getElementById('profile-card'); const summary = state.profile?.peerReviewSummary;
    if (!card) return;
    card.querySelector('.peer-review-summary')?.remove(); card.querySelector('[data-peer-feedback="1"]')?.remove();
    if (!summary || typeof summary !== 'object' || !Number(summary.reviewCount || 0)) return;
    const block = document.createElement('div'); block.className = 'profile-group profile-group-full peer-feedback-card'; block.dataset.peerFeedback = '1';
    const head = document.createElement('div'); head.className = 'peer-feedback-head'; const label = document.createElement('span'); label.className = 'profile-label'; label.textContent = '客户反馈'; const meta = document.createElement('span'); meta.className = 'peer-feedback-meta'; meta.textContent = `共 ${Number(summary.reviewCount)} 位客户反馈`; head.append(label, meta); block.appendChild(head);
    [['大家怎么称呼我', summary.topNicknames], ['他们和我的关系', summary.relationships || summary.topRelationships], ['他们眼中的我', summary.topTraits], ['他们愿意找我聊什么', summary.topTopics], ['他们觉得我更像哪种人', summary.topRoles]].forEach(([title, items]) => { if (Array.isArray(items) && items.length) block.appendChild(feedbackSection(title, items)); });
    const quotes = uniq((summary.representativeQuotes || summary.quotes || []).map((v) => text(v?.label ?? v))).filter(Boolean);
    if (quotes.length) { const section = document.createElement('section'); section.className = 'peer-feedback-section peer-feedback-quotes'; const h = document.createElement('h4'); h.textContent = '他们怎么向别人介绍我'; section.appendChild(h); const list = document.createElement('div'); list.className = 'peer-feedback-quote-list'; quotes.forEach((quote, index) => { const p = document.createElement('p'); p.textContent = quote; if (index >= 3) p.hidden = true; list.appendChild(p); }); section.appendChild(list); if (quotes.length > 3) { const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'text-button peer-feedback-more'; btn.textContent = `查看全部 ${quotes.length} 条`; btn.addEventListener('click', () => { const expanded = btn.dataset.expanded === '1'; [...list.children].forEach((node, i) => { if (i >= 3) node.hidden = expanded; }); btn.dataset.expanded = expanded ? '0' : '1'; btn.textContent = expanded ? `查看全部 ${quotes.length} 条` : '收起'; }); section.appendChild(btn); } block.appendChild(section); }
    const intro = card.querySelector('[data-signup-intro="1"]');
    if (intro) card.insertBefore(block, intro); else card.appendChild(block);
  }
  function ensureIntroLast() {
    const card = document.getElementById('profile-card'); const intro = text(state.profile?.selfIntro); if (!card || !intro) return;
    let group = card.querySelector('[data-signup-intro="1"]');
    if (!group) { group = document.createElement('div'); group.className = 'profile-group profile-group-full'; group.dataset.signupIntro = '1'; const label = document.createElement('span'); label.className = 'profile-label'; label.textContent = '个人介绍'; const value = document.createElement('div'); value.className = 'profile-value profile-long-value'; group.append(label, value); }
    group.querySelector('.profile-label').textContent = '个人介绍'; group.querySelector('.profile-value').textContent = intro; card.appendChild(group);
  }

  if (!document.getElementById('product-rules-v27-style')) { const style = document.createElement('style'); style.id = 'product-rules-v27-style'; style.textContent = `.profile-group-full{grid-column:1/-1}.peer-feedback-card{display:block!important;padding-top:18px;border-top:1px solid #eee}.peer-feedback-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:14px}.peer-feedback-meta{font-size:12px;color:#8a7f83}.peer-feedback-section{margin:14px 0}.peer-feedback-section h4{margin:0 0 8px;font-size:13px;color:#5f5659}.peer-feedback-chips{display:flex;flex-wrap:wrap;gap:8px}.peer-feedback-chip{display:inline-flex;align-items:center;padding:7px 10px;border:1px solid #eadfe3;border-radius:999px;background:#fff7f9;color:#5f3d48;font-size:13px}.peer-feedback-quote-list{display:grid;gap:8px}.peer-feedback-quote-list p{margin:0;padding:10px 12px;border-radius:10px;background:#f8f7f7;line-height:1.65;color:#4f484a}.peer-feedback-more{margin-top:8px}`; document.head.appendChild(style); }

  if (typeof startWorkspace === 'function') { const base = startWorkspace; startWorkspace = function startWorkspaceV27(profile, ...rest) { semanticKey='';extractFactsFromIntro(profile); const result=base(profile, ...rest); queueMicrotask(()=>semanticEnrich(profile)); return result; }; }
  if (typeof renderProfile === 'function') { const base = renderProfile; renderProfile = function renderProfileV27() { extractFactsFromIntro(state.profile || {}); const result = base(); requestAnimationFrame(() => { renderPeerFeedback(); ensureIntroLast(); }); queueMicrotask(()=>semanticEnrich(state.profile||{})); return result; }; }

  normalizeSignupProfile(state.profile || {});
  window.aiaProfileRulesV27 = Object.freeze({ normalizeSignupProfile, extractFactsFromIntro, semanticEnrich, renderPeerFeedback, ensureIntroLast, ownsNickname:false, ownsFloatingUi:false, ownsPeerFeedback:true });
})();
