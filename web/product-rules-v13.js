// 产品规则 V13：IP 问题精简、服务型简介、单一拓客/增员主线。
(function () {
  const educationQuestion = questions.find((item) => item.key === 'education');
  if (educationQuestion) {
    educationQuestion.chips = ['大专', '本科', '硕士', '博士', '不希望填写'];
  }

  const styleQuestion = questions.find((item) => item.key === 'contentTone');
  if (styleQuestion) {
    styleQuestion.ask = '你希望自己的内容说起话来是什么感觉？可以选 1～2 个最像你的风格，也可以自己补充。这个选择会影响后续的脚本改写风格。';
  }

  const purposeQuestion = questions.find((item) => item.key === 'purpose');
  if (purposeQuestion) {
    purposeQuestion.ask = '你做自媒体这阶段更想先做哪件事？建议刚刚起号时先选定一个方向开始，会更容易把账号做清楚。这个选择也会影响 IP 方案里的内容主线。';
    purposeQuestion.chips = ['拓客', '增员'];
  }

  function hasLegacyPurpose(value) {
    const text = String(value || '');
    return /拓客和增员|都要|两者|个人品牌/.test(text);
  }

  if (typeof startWorkspace === 'function') {
    const baseStartWorkspaceV13 = startWorkspace;
    startWorkspace = function startWorkspaceV13(profile, matched, history = [], proposals = [], planningHistory = [], contentPlans = [], creativeHistory = []) {
      if (profile && hasLegacyPurpose(profile.purpose)) profile.purpose = '';
      return baseStartWorkspaceV13(profile, matched, history, proposals, planningHistory, contentPlans, creativeHistory);
    };
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
    const evidence = realProfileEvidence(profile)
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

  function buildIpContentStrategyV13(profile = {}, proposal = {}) {
    const evidence = textEvidence(profile, proposal);
    const recruitment = String(profile.purpose || '').includes('增员');
    const lines = [
      recruitment
        ? line('增员内容主线', recruitmentDirections(evidence), ['展示职业', '吸引同频', '团队信任'], 'recruitment')
        : line('拓客内容主线', acquisitionDirections(evidence), ['建立信任', '吸引准客', '推动咨询'], 'acquisition'),
    ];
    const general = generalDirection(profile);
    lines.push(general
      ? line(`泛内容支线 · ${general}`, [general], ['扩大受众', '增加活人感', '打开流量'], 'general')
      : { title: '泛内容支线 · 暂未确定', kind: 'general', directions: [], collections: [], actionTags: ['扩大受众', '增加活人感', '打开流量'], empty: true });
    return {
      goal: recruitment ? 'recruitment' : 'acquisition',
      lines,
      focusReminder: recruitment
        ? '当前阶段先把增员主线做清楚，围绕职业价值、真实转型和团队日常持续输出；泛内容只保留一个长期方向。'
        : '当前阶段先把拓客主线做清楚，围绕客户真正关心的保障问题持续输出；泛内容只保留一个长期方向。',
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

  function renderIpContentStrategyV13(content, profile, proposal) {
    if (!content) return;
    content.querySelector('.ip-content-strategy')?.remove();
    const strategy = buildIpContentStrategyV13(profile, proposal);
    const section = document.createElement('section'); section.className = 'ip-content-strategy';
    const head = document.createElement('div'); head.className = 'ip-strategy-head';
    const words = document.createElement('div');
    const eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow'; eyebrow.textContent = '接下来发什么';
    const title = document.createElement('h2'); title.textContent = '你的内容主线';
    const intro = document.createElement('p'); intro.textContent = '根据你当前选择的拓客或增员目标，把保险主线先收成一个方向。';
    words.append(eyebrow, title, intro); head.appendChild(words); section.appendChild(head);
    const grid = document.createElement('div'); grid.className = 'ip-strategy-grid'; strategy.lines.forEach((item) => grid.appendChild(renderLine(item))); section.appendChild(grid);
    const reminder = document.createElement('div'); reminder.className = 'strategy-focus-reminder';
    const reminderTitle = document.createElement('strong'); reminderTitle.textContent = '📌 内容聚焦提醒';
    const reminderText = document.createElement('p'); reminderText.textContent = strategy.focusReminder;
    reminder.append(reminderTitle, reminderText); section.appendChild(reminder);
    content.appendChild(section);
  }

  const SERVICE_RULES = [
    [/养老|退休/, '养老规划'],
    [/教育金|子女教育|孩子教育/, '教育规划'],
    [/财富|资产配置|传承/, '财富规划'],
    [/家庭保障|家庭保险/, '家庭保障'],
    [/重疾|医疗|健康保障|健康管理/, '健康规划'],
    [/企业主|企业保障|团险/, '企业保障'],
    [/理赔/, '理赔协助'],
    [/保单检视|保单整理|保单分析/, '保单检视'],
    [/保障规划|保险规划|风险保障/, '保障规划'],
  ];

  function serviceEvidence(profile = {}) {
    return [profile.services, profile.serviceAreas, profile.serviceCapabilities, profile.expertise, profile.specialties]
      .filter(Boolean).join('｜');
  }

  function serviceLabels(profile = {}) {
    const evidence = serviceEvidence(profile);
    if (!evidence) return [];
    return unique(SERVICE_RULES.filter(([pattern]) => pattern.test(evidence)).map(([, label]) => label)).slice(0, 4);
  }

  function enhanceServiceBio(proposal, profile) {
    const services = serviceLabels(profile);
    const variants = proposal?.bios?.videoDouyin;
    if (!services.length || !Array.isArray(variants) || !variants.length) return;
    const target = variants[Math.min(1, variants.length - 1)];
    if (!target || !Array.isArray(target.lines)) return;
    target.label = '方案 B · 服务清单';
    target.focus = '把真实可提供的服务说清楚';
    const serviceLine = `🧭 ${services.join('｜')}`;
    const mandatory = (line) => /营销服务部|执业编号|个人意见|友邦人寿/.test(String(line || ''));
    const lines = target.lines.filter((line) => !/^🧭\s*/.test(String(line || '')));
    const firstMandatory = lines.findIndex(mandatory);
    if (lines.length < 6) {
      lines.splice(firstMandatory >= 0 ? firstMandatory : lines.length, 0, serviceLine);
    } else {
      let replaceAt = -1;
      for (let index = lines.length - 1; index >= 0; index -= 1) {
        if (!mandatory(lines[index])) { replaceAt = index; break; }
      }
      if (replaceAt >= 0) lines[replaceAt] = serviceLine;
    }
    target.lines = lines.slice(0, 6);
  }

  window.buildIpContentStrategy = buildIpContentStrategyV13;

  if (typeof renderProposal === 'function') {
    const baseRenderProposalV13 = renderProposal;
    renderProposal = function renderProposalV13(proposal, version) {
      enhanceServiceBio(proposal || {}, state.profile || {});
      const result = baseRenderProposalV13(proposal, version);
      renderIpContentStrategyV13(document.getElementById('proposal-content'), state.profile || {}, proposal || {});
      return result;
    };
  }
})();
