// 产品规则 V14：补齐内容支线来源，优先使用真实职业/身份/爱好证据。
(function () {
  function insertBeforeDepartment(question) {
    if (questions.some((item) => item.key === question.key)) return;
    const departmentIndex = questions.findIndex((item) => item.key === 'department');
    questions.splice(departmentIndex >= 0 ? departmentIndex : questions.length, 0, question);
  }

  insertBeforeDepartment({
    key: 'previousCareer',
    label: '过往职业/经历',
    ask: '你过去做过什么工作，或有哪些比较有代表性的长期经历？这类真实积累可以成为内容支线。可多选，也可以自己补充。',
    chips: ['教育/教师', '医疗健康', '法律', '财务/会计', '互联网/科技', '企业经营', '其他', '跳过'],
    multiple: true,
  });
  insertBeforeDepartment({
    key: 'lifeRoles',
    label: '家庭与生活身份',
    ask: '除了保险从业者之外，你还有哪些长期身份？比如宝爸宝妈、创业者、长期照护父母等。真实身份也可以成为内容支线。可多选，也可以自己补充。',
    chips: ['宝爸', '宝妈', '创业者', '职场人', '子女照护者', '其他', '跳过'],
    multiple: true,
  });
  insertBeforeDepartment({
    key: 'hobbies',
    label: '个人爱好',
    ask: '你有哪些真正长期在做、愿意持续分享的爱好？这些也可以成为内容支线。可多选，也可以自己补充。',
    chips: ['运动健身', '骑行', '跑步', '户外', '旅行', '摄影', '读书', '美食', '育儿', '其他', '跳过'],
    multiple: true,
  });

  if (typeof labels !== 'undefined') {
    labels.previousCareer = '过往职业/经历';
    labels.lifeRoles = '家庭与生活身份';
    labels.hobbies = '个人爱好';
  }

  const CAREER_RULES = [
    [/教师|教育|学校|升学|培训/, '升学教育'],
    [/医生|护士|医疗|健康|药|营养/, '健康养生'],
    [/律师|法律|法务/, '法律常识'],
    [/会计|财务|审计|税务/, '财务常识'],
    [/互联网|科技|产品|程序|工程师/, '科技职场'],
    [/企业|创业|经营|老板|管理/, '创业经营'],
  ];
  const ROLE_RULES = [
    [/宝爸|宝妈|父母|带娃|育儿|亲子/, '育儿'],
    [/创业者|企业经营/, '创业经营'],
    [/职场人/, '职场成长'],
    [/照护父母|子女照护|养老照护/, '家庭照护'],
  ];
  const HOBBY_RULES = [
    [/骑行/, '骑行'], [/跑步/, '跑步'], [/户外|露营|徒步/, '户外'], [/健身|运动|羽毛球|网球|游泳/, '运动健身'],
    [/旅行|旅游/, '旅行'], [/摄影/, '摄影'], [/读书|阅读/, '读书'], [/美食|烹饪|做饭/, '美食'], [/育儿|亲子/, '育儿'],
  ];

  function firstMatch(value, rules) {
    const text = String(value || '');
    for (const [pattern, direction] of rules) if (pattern.test(text)) return direction;
    return '';
  }

  function contentBranch(profile = {}) {
    const hobby = firstMatch(profile.hobbies, HOBBY_RULES);
    if (hobby) return { direction: hobby, source: '个人爱好' };
    const role = firstMatch(profile.lifeRoles, ROLE_RULES);
    if (role) return { direction: role, source: '家庭与生活身份' };
    const career = firstMatch(profile.previousCareer, CAREER_RULES);
    if (career) return { direction: career, source: '过往职业/经历' };

    const legacy = [profile.selfIntro, profile.strengths, profile.services, profile.expertise, profile.specialties].filter(Boolean).join('｜');
    const legacyHobby = firstMatch(legacy, HOBBY_RULES);
    if (legacyHobby) return { direction: legacyHobby, source: '已有个人资料' };
    const legacyRole = firstMatch(legacy, ROLE_RULES);
    if (legacyRole) return { direction: legacyRole, source: '已有个人资料' };
    const legacyCareer = firstMatch(legacy, CAREER_RULES);
    if (legacyCareer) return { direction: legacyCareer, source: '已有个人资料' };
    return { direction: '', source: '' };
  }

  const baseBuild = window.buildIpContentStrategy;
  if (typeof baseBuild === 'function') {
    window.buildIpContentStrategy = function buildIpContentStrategyV14(profile = {}, proposal = {}) {
      const strategy = baseBuild(profile, proposal);
      const branch = contentBranch(profile);
      const general = (strategy.lines || []).find((line) => line.kind === 'general');
      if (general) {
        if (branch.direction) {
          general.title = `内容支线 · ${branch.direction}`;
          general.directions = [branch.direction];
          general.collections = [Array.from(branch.direction).slice(0, 5).join('')];
          general.source = branch.source;
          general.empty = false;
        } else {
          general.title = '内容支线 · 暂未确定';
          general.directions = [];
          general.collections = [];
          general.source = '';
          general.empty = true;
        }
      }
      return strategy;
    };
  }

  function syncRenderedBranch(content, proposal) {
    if (!content) return;
    const strategy = window.buildIpContentStrategy?.(state.profile || {}, proposal || state.proposals?.[0]?.proposal || {});
    const general = (strategy?.lines || []).find((line) => line.kind === 'general');
    const card = content.querySelector('.ip-strategy-general');
    if (!general || !card) return;
    const heading = card.querySelector('h3');
    if (heading) heading.textContent = general.title || '内容支线';
    const blocks = card.querySelectorAll('.strategy-block');
    const directionList = blocks[0]?.querySelector('.strategy-chip-list');
    if (directionList) {
      directionList.innerHTML = '';
      if (general.directions?.length) general.directions.forEach((value) => { const chip = document.createElement('span'); chip.className = 'strategy-chip'; chip.textContent = value; directionList.appendChild(chip); });
      else { const chip = document.createElement('span'); chip.className = 'strategy-chip strategy-empty-chip'; chip.textContent = '暂未确定'; directionList.appendChild(chip); }
    }
    const collectionList = blocks[1]?.querySelector('.strategy-chip-list');
    if (collectionList) {
      collectionList.innerHTML = '';
      if (general.collections?.length) general.collections.forEach((value) => { const chip = document.createElement('span'); chip.className = 'strategy-collection-chip'; chip.textContent = value; collectionList.appendChild(chip); });
      else { const hint = document.createElement('p'); hint.className = 'strategy-empty-text'; hint.textContent = '先补充一项你真正长期在做、也愿意持续分享的经历、身份或爱好，我再帮你定这一条。'; collectionList.appendChild(hint); }
    }
    card.querySelector('.strategy-source-note')?.remove();
    if (general.source) { const note = document.createElement('p'); note.className = 'strategy-source-note'; note.textContent = `来源：${general.source}`; heading?.insertAdjacentElement('afterend', note); }
  }

  function addSourceLabels(content, proposal) {
    if (!content) return;
    const strategy = window.buildIpContentStrategy?.(state.profile || {}, proposal || state.proposals?.[0]?.proposal || {});
    const sourceByKind = new Map((strategy?.lines || []).map((line) => [line.kind, line.source || '']));
    content.querySelectorAll('.ip-strategy-line').forEach((card) => {
      const kind = [...card.classList].find((name) => name.startsWith('ip-strategy-'))?.replace('ip-strategy-', '');
      const source = sourceByKind.get(kind);
      card.querySelector('.strategy-source-note')?.remove();
      if (!source) return;
      const note = document.createElement('p'); note.className = 'strategy-source-note'; note.textContent = `来源：${source}`;
      card.querySelector('h3')?.insertAdjacentElement('afterend', note);
    });
  }

  if (typeof renderProposal === 'function') {
    const baseRenderProposalV14 = renderProposal;
    renderProposal = function renderProposalV14(proposal, version) {
      const result = baseRenderProposalV14(proposal, version);
      const content = document.getElementById('proposal-content');
      syncRenderedBranch(content, proposal);
      addSourceLabels(content, proposal);
      return result;
    };
  }
})();
