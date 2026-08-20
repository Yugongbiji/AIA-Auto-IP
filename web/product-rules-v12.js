// 产品规则 V12：撤销独立内容规划入口，把精简内容策略合并到 IP 方案底部。
(function () {
  const planningTab = document.querySelector('[data-tool="planning"]');
  planningTab?.remove();
  document.getElementById('planning-panel')?.classList.add('hidden');
  document.getElementById('content-plan-screen')?.classList.add('hidden');

  const purposeQuestion = questions.find((item) => item.key === 'purpose');
  if (purposeQuestion) {
    purposeQuestion.label = '做自媒体目的';
    purposeQuestion.ask = '你做自媒体主要想实现什么？如果拓客和增员都需要，也可以直接选“拓客和增员都要”。';
    purposeQuestion.chips = ['拓客', '增员', '拓客和增员都要', '打造个人品牌'];
  }

  const COLLECTION_NAMES = {
    '家庭保障方案': '家庭保障', '理赔案例': '理赔案例', '保险科普': '保险科普', '养老规划': '养老规划',
    '医疗保障': '医疗保障', '教育金规划': '教育金', '企业保障': '企业保障', '财富规划': '财富规划',
    '转型经历': '转型日记', '行业发展': '行业观察', '团队日常': '团队日常', '个人成长': '成长手记', '从业经验': '从业笔记',
    '育儿': '育儿手记', '升学规划': '升学攻略', '骑行': '骑行日记', '户外': '户外日记', '运动': '运动日记',
    '法律': '法律常识', '职场成长': '职场成长', '女性成长': '女性成长', '旅行': '旅行日记', '摄影': '摄影日记',
    '读书': '读书笔记', '美食': '美食日记',
  };

  const GENERAL_RULES = [
    [/骑行/, '骑行'], [/升学/, '升学规划'], [/户外|露营|徒步/, '户外'], [/跑步|羽毛球|网球|足球|游泳|健身|运动/, '运动'],
    [/法律|律师/, '法律'], [/职场/, '职场成长'], [/女性成长|女性话题/, '女性成长'], [/旅行|旅游/, '旅行'], [/摄影/, '摄影'],
    [/读书|阅读/, '读书'], [/美食|烹饪|做饭/, '美食'], [/育儿|带娃|亲子/, '育儿'],
  ];

  function textEvidence(profile, proposal) {
    const values = [
      profile?.selfIntro, profile?.strengths, profile?.services, profile?.serviceAreas, profile?.serviceCapabilities,
      profile?.expertise, profile?.specialties, profile?.honors, profile?.customerGroups,
      proposal?.headline, proposal?.subheadline, proposal?.tags, proposal?.advantages,
    ];
    return JSON.stringify(values, null, 0);
  }

  function realProfileEvidence(profile) {
    const values = [
      profile?.selfIntro, profile?.strengths, profile?.services, profile?.serviceAreas, profile?.serviceCapabilities,
      profile?.expertise, profile?.specialties, profile?.honors,
    ];
    return JSON.stringify(values, null, 0);
  }

  function goalFromPurpose(value) {
    const purpose = String(value || '');
    if ((purpose.includes('拓客') && purpose.includes('增员')) || /都要|两者/.test(purpose)) return 'both';
    if (purpose.includes('增员')) return 'recruitment';
    if (purpose.includes('打造个人品牌')) return 'brand';
    return 'acquisition';
  }

  function unique(items) { return [...new Set(items.filter(Boolean))]; }

  function acquisitionDirections(evidence) {
    const result = [];
    if (/养老/.test(evidence)) result.push('养老规划');
    if (/教育金/.test(evidence)) result.push('教育金规划');
    if (/理赔/.test(evidence)) result.push('理赔案例');
    if (/医疗|健康|重疾/.test(evidence)) result.push('医疗保障');
    if (/企业主/.test(evidence)) result.push('企业保障');
    if (/财富|传承/.test(evidence)) result.push('财富规划');
    if (/家庭|宝爸|宝妈|父母|孩子/.test(evidence)) result.push('家庭保障方案');
    return unique([...result, '家庭保障方案', '理赔案例', '保险科普', '养老规划']).slice(0, 4);
  }

  function recruitmentDirections(evidence) {
    const result = [];
    if (/转型|转行|跨行/.test(evidence)) result.push('转型经历');
    if (/团队|主管|带教|培训/.test(evidence)) result.push('团队日常');
    return unique([...result, '行业发展', '个人成长', '从业经验', '团队日常']).slice(0, 4);
  }

  function generalDirection(profile) {
    // 泛内容只能从本人真实资料中的明确兴趣、经历或积累提取；AI 生成的方案文案/标签不能作为证据。
    let evidence = realProfileEvidence(profile)
      .replace(/教育金/g, '')
      .replace(/养老保险|医疗险|重疾险|意外险/g, '')
      .replace(/保险|保障|保单|理赔|投保|保费|年金|寿险/g, '');
    for (const [pattern, direction] of GENERAL_RULES) if (pattern.test(evidence)) return direction;
    return '';
  }

  function sanitizeCollectionName(value) {
    const preferred = COLLECTION_NAMES[value] || String(value || '').replace(/方案|规划/g, '');
    return Array.from(preferred).slice(0, 5).join('');
  }

  function line(title, directions, actionTags, kind) {
    return {
      title,
      kind,
      directions: unique(directions).slice(0, 4),
      collections: unique(directions).slice(0, 4).map(sanitizeCollectionName),
      actionTags,
    };
  }

  function buildIpContentStrategy(profile = {}, proposal = {}) {
    const evidence = textEvidence(profile, proposal);
    const goal = goalFromPurpose(profile.purpose);
    const lines = [];
    if (goal === 'acquisition' || goal === 'brand') {
      lines.push(line('保险专业主线', acquisitionDirections(evidence), ['建立信任', '吸引准客', '推动咨询'], 'acquisition'));
    }
    if (goal === 'recruitment') {
      lines.push(line('增员内容主线', recruitmentDirections(evidence), ['展示职业', '吸引同频', '团队信任'], 'recruitment'));
    }
    if (goal === 'both') {
      lines.push(line('拓客内容主线', acquisitionDirections(evidence), ['建立信任', '吸引准客', '推动咨询'], 'acquisition'));
      lines.push(line('增员内容主线', recruitmentDirections(evidence), ['展示职业', '吸引同频', '团队信任'], 'recruitment'));
    }
    const general = generalDirection(profile);
    lines.push(general
      ? line(`泛内容支线 · ${general}`, [general], ['扩大受众', '增加活人感', '打开流量'], 'general')
      : { title: '泛内容支线 · 暂未确定', kind: 'general', directions: [], collections: [], actionTags: ['扩大受众', '增加活人感', '打开流量'], empty: true });

    return {
      goal,
      lines,
      focusReminder: goal === 'both'
        ? '拓客和增员都可以做，但同一阶段要有明显主次；不要在客户保险内容和招募内容之间高频来回跳。泛内容也只保留一个长期方向。'
        : '专业主线保持稳定，泛内容只保留一个能长期讲的真实方向。持续做深，比频繁更换主题更容易形成清晰账号标签。',
    };
  }

  function chip(text, className) {
    const node = document.createElement('span'); node.className = className; node.textContent = text; return node;
  }

  function renderLine(item) {
    const card = document.createElement('article'); card.className = `ip-strategy-line ip-strategy-${item.kind}`;
    const heading = document.createElement('h3'); heading.textContent = item.title; card.appendChild(heading);

    const directions = document.createElement('div'); directions.className = 'strategy-block';
    const directionTitle = document.createElement('strong'); directionTitle.textContent = '内容方向'; directions.appendChild(directionTitle);
    const directionList = document.createElement('div'); directionList.className = 'strategy-chip-list';
    if (item.empty) directionList.append(chip('暂未确定', 'strategy-chip strategy-empty-chip'));
    else item.directions.forEach((value) => directionList.append(chip(value, 'strategy-chip')));
    directions.appendChild(directionList); card.appendChild(directions);

    const collections = document.createElement('div'); collections.className = 'strategy-block';
    const collectionTitle = document.createElement('strong'); collectionTitle.textContent = '合集推荐'; collections.appendChild(collectionTitle);
    const collectionList = document.createElement('div'); collectionList.className = 'strategy-chip-list';
    if (item.empty) {
      const hint = document.createElement('p'); hint.className = 'strategy-empty-text'; hint.textContent = '先告诉我一个你真正长期在做、也愿意持续分享的兴趣或积累，我再帮你定这一条。'; collectionList.appendChild(hint);
    } else item.collections.forEach((value) => collectionList.append(chip(value, 'strategy-collection-chip')));
    collections.appendChild(collectionList); card.appendChild(collections);

    const actions = document.createElement('div'); actions.className = 'strategy-block';
    const actionTitle = document.createElement('strong'); actionTitle.textContent = '对账号的作用'; actions.appendChild(actionTitle);
    const actionList = document.createElement('div'); actionList.className = 'strategy-action-list';
    item.actionTags.forEach((value) => actionList.append(chip(value, 'strategy-action-tag')));
    actions.appendChild(actionList); card.appendChild(actions);
    return card;
  }

  function renderIpContentStrategy(content, profile, proposal) {
    if (!content) return;
    content.querySelector('.ip-content-strategy')?.remove();
    const strategy = buildIpContentStrategy(profile, proposal);
    const section = document.createElement('section'); section.className = 'ip-content-strategy';
    const head = document.createElement('div'); head.className = 'ip-strategy-head';
    const words = document.createElement('div');
    const eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow'; eyebrow.textContent = '接下来发什么';
    const title = document.createElement('h2'); title.textContent = '你的内容主线';
    const intro = document.createElement('p'); intro.textContent = '根据你的目标、人设和已有资料，先把长期能做的方向收清楚。';
    words.append(eyebrow, title, intro); head.appendChild(words); section.appendChild(head);
    const grid = document.createElement('div'); grid.className = 'ip-strategy-grid'; strategy.lines.forEach((item) => grid.appendChild(renderLine(item))); section.appendChild(grid);
    const reminder = document.createElement('div'); reminder.className = 'strategy-focus-reminder';
    const reminderTitle = document.createElement('strong'); reminderTitle.textContent = '📌 内容聚焦提醒';
    const reminderText = document.createElement('p'); reminderText.textContent = strategy.focusReminder;
    reminder.append(reminderTitle, reminderText); section.appendChild(reminder);
    content.appendChild(section);
  }

  window.buildIpContentStrategy = buildIpContentStrategy;
  window.renderIpContentStrategy = renderIpContentStrategy;
  window.sanitizeCollectionName = sanitizeCollectionName;

  if (typeof selectTool === 'function') {
    const baseSelectToolV12 = selectTool;
    selectTool = function selectToolV12(tool) { return baseSelectToolV12(tool === 'planning' ? 'ip' : tool); };
  }

  if (typeof renderProposal === 'function') {
    const baseRenderProposalV12 = renderProposal;
    renderProposal = function renderProposalV12(proposal, version) {
      const result = baseRenderProposalV12(proposal, version);
      renderIpContentStrategy(document.getElementById('proposal-content'), state.profile || {}, proposal || {});
      return result;
    };
  }
})();
