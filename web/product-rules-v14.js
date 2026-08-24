// 产品规则 V14：内容支线识别 + 业务价值排序。规则基线见 rules/content-branch-ranking-v1.md。
(function () {
  function insertBeforeDepartment(question) {
    if (questions.some((item) => item.key === question.key)) return;
    const departmentIndex = questions.findIndex((item) => item.key === 'department');
    questions.splice(departmentIndex >= 0 ? departmentIndex : questions.length, 0, question);
  }

  insertBeforeDepartment({ key: 'previousCareer', label: '过往职业/经历', ask: '你过去做过什么工作，或有哪些比较有代表性的长期经历？这类真实积累可以成为内容支线。可多选，也可以自己补充。', chips: ['教育/教师', '医疗健康', '法律', '财务/会计', '互联网/科技', '企业经营', '其他', '跳过'], multiple: true });
  insertBeforeDepartment({ key: 'lifeRoles', label: '家庭与生活身份', ask: '除了保险从业者之外，你还有哪些长期身份？比如宝爸宝妈、创业者、长期照护父母等。真实身份也可以成为内容支线。可多选，也可以自己补充。', chips: ['宝爸', '宝妈', '创业者', '职场人', '子女照护者', '其他', '跳过'], multiple: true });
  insertBeforeDepartment({ key: 'hobbies', label: '个人爱好', ask: '你有哪些真正长期在做、愿意持续分享的爱好？这些也可以成为内容支线。可多选，也可以自己补充。', chips: ['运动健身', '骑行', '跑步', '户外', '旅行', '摄影', '读书', '美食', '育儿', '其他', '跳过'], multiple: true });
  if (typeof labels !== 'undefined') { labels.previousCareer = '过往职业/经历'; labels.lifeRoles = '家庭与生活身份'; labels.hobbies = '个人爱好'; }

  // 基础分只表达业务先验，不把年龄、收入或爱好画像当成确定事实。
  const BASE_SCORES = {
    '育儿': 90, '升学教育': 88, '健康养生': 86, '家庭照护': 86, '创业经营': 85, '财务常识': 84,
    '职场成长': 80, '法律常识': 78, '高尔夫': 78, '网球': 74, '骑行': 72, '滑雪': 72,
    '运动健身': 70, '旅行': 68, '汽车': 68, '摄影': 64, '户外': 64, '跑步': 63, '读书': 62,
    '美食': 55, '宠物': 54, '影视娱乐': 48, '生活日常': 45, '科技职场': 72,
  };
  const RULES = [
    [/宝爸|宝妈|父母|带娃|育儿|亲子/, '育儿'], [/教师|教育|学校|升学|培训/, '升学教育'],
    [/医生|护士|医疗|健康|药|营养/, '健康养生'], [/照护父母|子女照护|养老照护/, '家庭照护'],
    [/企业|创业|经营|老板|管理/, '创业经营'], [/会计|财务|审计|税务/, '财务常识'],
    [/职场|职业转型/, '职场成长'], [/律师|法律|法务/, '法律常识'], [/互联网|科技|产品|程序|工程师/, '科技职场'],
    [/高尔夫/, '高尔夫'], [/网球/, '网球'], [/骑行/, '骑行'], [/滑雪/, '滑雪'],
    [/健身|运动|羽毛球|游泳/, '运动健身'], [/旅行|旅游/, '旅行'], [/汽车|自驾/, '汽车'],
    [/摄影/, '摄影'], [/户外|露营|徒步/, '户外'], [/跑步/, '跑步'], [/读书|阅读/, '读书'],
    [/美食|烹饪|做饭/, '美食'], [/宠物|猫|狗/, '宠物'], [/影视|电影|追剧/, '影视娱乐'],
  ];

  function splitValues(value) { return String(value || '').split(/[｜|、,，;；/\n]+/).map((item) => item.trim()).filter(Boolean); }
  function matches(text) {
    const found = [];
    RULES.forEach(([pattern, direction]) => { if (pattern.test(text) && !found.includes(direction)) found.push(direction); });
    return found;
  }
  function collectCandidates(profile = {}) {
    const candidates = new Map();
    function add(direction, source, evidence, strength) {
      if (!direction) return;
      const current = candidates.get(direction) || { direction, sources: [], evidence: [], evidenceStrength: 0 };
      if (!current.sources.includes(source)) current.sources.push(source);
      if (evidence && !current.evidence.includes(evidence)) current.evidence.push(evidence);
      current.evidenceStrength = Math.max(current.evidenceStrength, strength || 0);
      candidates.set(direction, current);
    }
    const fields = [
      ['previousCareer', '过往职业/经历', 8], ['lifeRoles', '家庭与生活身份', 8], ['hobbies', '个人爱好', 4],
    ];
    fields.forEach(([key, source, strength]) => splitValues(profile[key]).forEach((value) => matches(value).forEach((direction) => add(direction, source, value, strength))));
    const legacy = [profile.selfIntro, profile.strengths, profile.services, profile.expertise, profile.specialties].filter(Boolean).join('｜');
    matches(legacy).forEach((direction) => add(direction, '已有个人资料', legacy, 5));
    return [...candidates.values()].map((candidate) => ({
      ...candidate,
      baseScore: BASE_SCORES[candidate.direction] || 50,
      score: (BASE_SCORES[candidate.direction] || 50) + candidate.evidenceStrength,
    })).sort((a, b) => b.score - a.score || b.baseScore - a.baseScore || b.evidenceStrength - a.evidenceStrength);
  }
  function contentBranch(profile = {}) {
    const ranked = collectCandidates(profile);
    const best = ranked[0];
    if (!best) return { direction: '', source: '', ranked: [] };
    return { direction: best.direction, source: best.sources.join(' + '), ranked };
  }
  window.rankIpContentBranches = collectCandidates;

  const baseBuild = window.buildIpContentStrategy;
  if (typeof baseBuild === 'function') {
    window.buildIpContentStrategy = function buildIpContentStrategyV14(profile = {}, proposal = {}) {
      const strategy = baseBuild(profile, proposal);
      const branch = contentBranch(profile);
      strategy.contentBranchRanking = branch.ranked;
      const general = (strategy.lines || []).find((line) => line.kind === 'general');
      if (general) {
        if (branch.direction) {
          general.title = `内容支线 · ${branch.direction}`; general.directions = [branch.direction]; general.collections = [branch.direction];
          general.source = branch.source; general.empty = false; general.ranking = branch.ranked;
        } else {
          general.title = '内容支线 · 暂未确定'; general.directions = []; general.collections = []; general.source = ''; general.empty = true; general.ranking = [];
        }
      }
      return strategy;
    };
  }

  function syncRenderedBranch(content, proposal) {
    if (!content) return;
    const strategy = window.buildIpContentStrategy?.(state.profile || {}, proposal || state.proposals?.[0]?.proposal || {});
    const general = (strategy?.lines || []).find((line) => line.kind === 'general'); const card = content.querySelector('.ip-strategy-general');
    if (!general || !card) return;
    const heading = card.querySelector('h3'); if (heading) heading.textContent = general.title || '内容支线';
    const blocks = card.querySelectorAll('.strategy-block'); const directionList = blocks[0]?.querySelector('.strategy-chip-list');
    if (directionList) { directionList.innerHTML = ''; if (general.directions?.length) general.directions.forEach((value) => { const chip = document.createElement('span'); chip.className = 'strategy-chip'; chip.textContent = value; directionList.appendChild(chip); }); else { const chip = document.createElement('span'); chip.className = 'strategy-chip strategy-empty-chip'; chip.textContent = '暂未确定'; directionList.appendChild(chip); } }
    const collectionList = blocks[1]?.querySelector('.strategy-chip-list');
    if (collectionList) { collectionList.innerHTML = ''; if (general.collections?.length) general.collections.forEach((value) => { const chip = document.createElement('span'); chip.className = 'strategy-collection-chip'; chip.textContent = value; collectionList.appendChild(chip); }); else { const hint = document.createElement('p'); hint.className = 'strategy-empty-text'; hint.textContent = '先补充一项你真正长期在做、也愿意持续分享的经历、身份或爱好，我再帮你定这一条。'; collectionList.appendChild(hint); } }
    card.querySelector('.strategy-source-note')?.remove();
    if (general.source) { const note = document.createElement('p'); note.className = 'strategy-source-note'; note.textContent = `来源：${general.source}`; heading?.insertAdjacentElement('afterend', note); }
  }
  function addSourceLabels(content, proposal) {
    if (!content) return; const strategy = window.buildIpContentStrategy?.(state.profile || {}, proposal || state.proposals?.[0]?.proposal || {});
    const sourceByKind = new Map((strategy?.lines || []).map((line) => [line.kind, line.source || '']));
    content.querySelectorAll('.ip-strategy-line').forEach((card) => { const kind = [...card.classList].find((name) => name.startsWith('ip-strategy-'))?.replace('ip-strategy-', ''); const source = sourceByKind.get(kind); card.querySelector('.strategy-source-note')?.remove(); if (!source) return; const note = document.createElement('p'); note.className = 'strategy-source-note'; note.textContent = `来源：${source}`; card.querySelector('h3')?.insertAdjacentElement('afterend', note); });
  }
  if (typeof renderProposal === 'function') {
    const baseRenderProposalV14 = renderProposal;
    renderProposal = function renderProposalV14(proposal, version) { const result = baseRenderProposalV14(proposal, version); const content = document.getElementById('proposal-content'); syncRenderedBranch(content, proposal); addSourceLabels(content, proposal); return result; };
  }
})();
