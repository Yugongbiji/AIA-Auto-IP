// IP 人设悬浮入口唯一 Owner。
// 只负责：IP 页面悬浮入口、独立资料抽屉、打开最新 IP 方案。
// 不复用旧 .profile-panel，不依赖 activeTool / proposal-open / 旧 overlay 状态。
(function () {
  'use strict';

  const IDS = Object.freeze({
    actions: 'aia-ip-owner-actions',
    profileButton: 'aia-ip-owner-profile-button',
    proposalButton: 'aia-ip-owner-proposal-button',
    drawer: 'aia-ip-owner-profile-drawer',
    drawerBody: 'aia-ip-owner-profile-body',
    drawerClose: 'aia-ip-owner-profile-close',
  });

  const text = (value) => String(value ?? '').trim();
  const splitValues = (value) => text(value).split(/[｜|、,，;；/\n]+/).map((v) => v.trim()).filter(Boolean);
  const uniq = (values) => [...new Set((values || []).filter(Boolean))];

  function workspaceVisible() {
    const workspace = document.getElementById('workspace');
    const identity = document.getElementById('identity-screen');
    const chat = document.getElementById('ip-chat-panel');
    return !!workspace && !workspace.classList.contains('hidden')
      && (!identity || identity.classList.contains('hidden'))
      && !!chat && !chat.classList.contains('hidden');
  }

  function latestProposal() {
    return Array.isArray(state?.proposals) && state.proposals.length ? state.proposals[0] : null;
  }

  function primaryGoalLabel(value) {
    if (value === 'customer_acquisition') return '拓客';
    if (value === 'recruitment') return '增员';
    return text(value);
  }

  function makeButton(id, label, icon) {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.className = 'aia-ip-owner-button';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.innerHTML = `<span aria-hidden="true" class="aia-ip-owner-icon">${icon}</span><span class="aia-ip-owner-tooltip">${label}</span>`;
    return button;
  }

  function createShell() {
    document.getElementById(IDS.actions)?.remove();
    document.getElementById(IDS.drawer)?.remove();

    const actions = document.createElement('div');
    actions.id = IDS.actions;
    actions.className = 'aia-ip-owner-actions';
    actions.setAttribute('aria-label', 'IP 快捷入口');

    const profileButton = makeButton(IDS.profileButton, '我的 IP 资料', '👤');
    const proposalButton = makeButton(IDS.proposalButton, 'IP 方案', '✨');
    actions.append(profileButton, proposalButton);

    const drawer = document.createElement('aside');
    drawer.id = IDS.drawer;
    drawer.className = 'aia-ip-owner-drawer';
    drawer.hidden = true;
    drawer.setAttribute('aria-label', '我的 IP 资料');
    drawer.innerHTML = `
      <header class="aia-ip-owner-drawer-head">
        <div><span>当前创作上下文</span><h2>我的 IP 资料</h2></div>
        <button id="${IDS.drawerClose}" type="button" aria-label="关闭我的 IP 资料">×</button>
      </header>
      <div id="${IDS.drawerBody}" class="aia-ip-owner-drawer-body"></div>
      <p class="aia-ip-owner-drawer-hint">💬 想修改资料，直接在 IP 对话框里告诉我即可。</p>`;

    document.body.append(actions, drawer);

    profileButton.addEventListener('click', () => {
      renderProfileDrawer();
      drawer.hidden = !drawer.hidden;
      profileButton.setAttribute('aria-expanded', drawer.hidden ? 'false' : 'true');
    });
    proposalButton.addEventListener('click', () => {
      const latest = latestProposal();
      if (!latest || typeof renderProposal !== 'function') return;
      drawer.hidden = true;
      profileButton.setAttribute('aria-expanded', 'false');
      renderProposal(latest.proposal, latest.version);
    });
    drawer.querySelector(`#${IDS.drawerClose}`)?.addEventListener('click', () => {
      drawer.hidden = true;
      profileButton.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('click', (event) => {
      if (drawer.hidden) return;
      if (drawer.contains(event.target) || actions.contains(event.target)) return;
      drawer.hidden = true;
      profileButton.setAttribute('aria-expanded', 'false');
    });
  }

  function addField(grid, label, value) {
    const clean = text(value);
    if (!clean) return;
    const item = document.createElement('div');
    item.className = 'aia-ip-owner-field';
    const key = document.createElement('span'); key.textContent = label;
    const val = document.createElement('strong'); val.textContent = clean;
    item.append(key, val); grid.appendChild(item);
  }

  function addSection(body, title, fields, full = false) {
    const usable = fields.filter(([, value]) => text(value));
    if (!usable.length) return;
    const section = document.createElement('section');
    section.className = `aia-ip-owner-section${full ? ' is-full' : ''}`;
    const heading = document.createElement('h3'); heading.textContent = title;
    const grid = document.createElement('div'); grid.className = 'aia-ip-owner-grid';
    usable.forEach(([label, value]) => addField(grid, label, value));
    section.append(heading, grid); body.appendChild(section);
  }

  function countChips(items) {
    const map = new Map();
    (items || []).forEach((item) => {
      const label = text(item?.label ?? item);
      if (!label) return;
      const count = Math.max(1, Number(item?.count || 1) || 1);
      map.set(label, (map.get(label) || 0) + count);
    });
    return [...map.entries()].map(([label, count]) => ({ label, count }));
  }

  function appendFeedbackGroup(parent, title, items) {
    const values = countChips(items);
    if (!values.length) return;
    const group = document.createElement('div'); group.className = 'aia-ip-owner-feedback-group';
    const h = document.createElement('h4'); h.textContent = title;
    const chips = document.createElement('div'); chips.className = 'aia-ip-owner-chips';
    values.forEach(({ label, count }) => {
      const chip = document.createElement('span');
      chip.textContent = count > 1 ? `${label} ×${count}` : label;
      chips.appendChild(chip);
    });
    group.append(h, chips); parent.appendChild(group);
  }

  function addCustomerFeedback(body, summary) {
    if (!summary || typeof summary !== 'object' || !Number(summary.reviewCount || 0)) return;
    const section = document.createElement('section'); section.className = 'aia-ip-owner-section is-full';
    const head = document.createElement('div'); head.className = 'aia-ip-owner-section-head';
    const title = document.createElement('h3'); title.textContent = '客户反馈';
    const meta = document.createElement('span'); meta.textContent = `共 ${Number(summary.reviewCount)} 位反馈`;
    head.append(title, meta); section.appendChild(head);
    appendFeedbackGroup(section, '大家怎么称呼我', summary.topNicknames);
    appendFeedbackGroup(section, '他们和我的关系', summary.relationships || summary.topRelationships);
    appendFeedbackGroup(section, '他们眼中的我', summary.topTraits);
    appendFeedbackGroup(section, '他们愿意找我聊什么', summary.topTopics);
    appendFeedbackGroup(section, '他们觉得我更像哪种人', summary.topRoles);
    const quotes = uniq((summary.representativeQuotes || summary.quotes || []).map((v) => text(v?.label ?? v)));
    if (quotes.length) {
      const group = document.createElement('div'); group.className = 'aia-ip-owner-feedback-group';
      const h = document.createElement('h4'); h.textContent = '他们怎么向别人介绍我'; group.appendChild(h);
      quotes.slice(0, 5).forEach((quote) => { const p = document.createElement('p'); p.className = 'aia-ip-owner-quote'; p.textContent = quote; group.appendChild(p); });
      section.appendChild(group);
    }
    body.appendChild(section);
  }

  function renderProfileDrawer() {
    const body = document.getElementById(IDS.drawerBody);
    if (!body) return;
    const p = state?.profile || {};
    body.innerHTML = '';

    addSection(body, '基本资料', [
      ['姓名', p.name], ['营销员编号', p.agentId], ['所在城市', p.city], ['营销服务部', p.department],
      ['入职日期', p.joinDate], ['保险从业时间', p.insuranceYears],
    ]);

    addSection(body, '经历与优势资料', [
      ['学历', p.education], ['学校背景', p.schoolTier], ['留学背景', p.overseas], ['过往职业 / 工作经历', p.previousCareer],
      ['荣誉', p.honors], ['长期身份', p.lifeRoles], ['兴趣爱好', p.hobbies], ['优势', p.strengths], ['可提供服务', p.services],
    ]);

    addSection(body, '账号资料', [
      ['账号优先目标', primaryGoalLabel(p.primaryGoal)], ['账号表达风格', p.contentTone],
      ['原视频号昵称', p.videoNickname], ['原小红书昵称', p.xiaohongshuNickname || p.xhsNickname],
      ['历史报名目的', p.purpose], ['账号运营状态', p.status], ['当前卡点', p.painpoints], ['时间投入', p.timeInvest],
    ]);

    addCustomerFeedback(body, p.peerReviewSummary);

    if (text(p.selfIntro)) {
      const section = document.createElement('section'); section.className = 'aia-ip-owner-section is-full';
      const h = document.createElement('h3'); h.textContent = '个人介绍';
      const paragraph = document.createElement('p'); paragraph.className = 'aia-ip-owner-intro'; paragraph.textContent = text(p.selfIntro);
      section.append(h, paragraph); body.appendChild(section);
    }

    if (!body.children.length) {
      const empty = document.createElement('p'); empty.className = 'aia-ip-owner-empty'; empty.textContent = '当前还没有可展示的资料。'; body.appendChild(empty);
    }
  }

  function sync() {
    const actions = document.getElementById(IDS.actions);
    const proposalButton = document.getElementById(IDS.proposalButton);
    const drawer = document.getElementById(IDS.drawer);
    if (!actions || !proposalButton || !drawer) return;
    const visible = workspaceVisible();
    actions.hidden = !visible;
    proposalButton.hidden = !latestProposal();
    if (!visible) drawer.hidden = true;
  }

  createShell();
  sync();

  // 只做 UI 同步，不改业务数据；后续 Owner 可以继续包裹这些函数。
  if (typeof startWorkspace === 'function') {
    const base = startWorkspace;
    startWorkspace = function floatingOwnerStartWorkspace() {
      const result = base.apply(this, arguments);
      queueMicrotask(() => { renderProfileDrawer(); sync(); });
      return result;
    };
  }
  if (typeof selectTool === 'function') {
    const base = selectTool;
    selectTool = function floatingOwnerSelectTool() {
      const result = base.apply(this, arguments);
      queueMicrotask(sync);
      return result;
    };
  }
  if (typeof renderProfile === 'function') {
    const base = renderProfile;
    renderProfile = function floatingOwnerRenderProfile() {
      const result = base.apply(this, arguments);
      queueMicrotask(() => { renderProfileDrawer(); sync(); });
      return result;
    };
  }
  if (typeof refreshProposalButton === 'function') {
    const base = refreshProposalButton;
    refreshProposalButton = function floatingOwnerRefreshProposalButton() {
      const result = base.apply(this, arguments);
      queueMicrotask(sync);
      return result;
    };
  }
  if (typeof generateProposal === 'function') {
    const base = generateProposal;
    generateProposal = async function floatingOwnerGenerateProposal() {
      const result = await base.apply(this, arguments);
      renderProfileDrawer(); sync();
      return result;
    };
  }

  ['workspace', 'identity-screen', 'ip-chat-panel'].map((id) => document.getElementById(id)).filter(Boolean).forEach((node) => {
    new MutationObserver(() => queueMicrotask(sync)).observe(node, { attributes: true, attributeFilter: ['class'] });
  });

  window.aiaFloatingUi = Object.freeze({
    sync,
    renderProfileDrawer,
    workspaceVisible,
    latestProposal,
    owner: 'web/profile-float.js',
    ownsProfileData: false,
    independentDrawer: true,
  });
})();