// 产品规则 V26：内容支线统一证据池；报名自我介绍标准化并进入资料展示。
(function () {
  const BASE = {
    '育儿': 90, '升学教育': 88, '健康养生': 86, '创业经营': 85, '财务常识': 84,
    '职场成长': 80, '法律常识': 78, '高尔夫': 78, '网球': 74, '骑行': 72, '滑雪': 72,
    '科技职场': 72, '运动健身': 70, '旅行': 68, '汽车': 68, '摄影': 64, '户外': 64,
    '跑步': 63, '读书': 62, '美食': 55, '宠物': 54, '影视娱乐': 48, '生活日常': 45,
  };
  const MAP = [
    [/宝爸|宝妈|父母|孩子|带娃|育儿|亲子|母婴|家庭身份|家庭与生活身份/, '育儿'],
    [/教师|教育|学校|升学|培训|教培/, '升学教育'],
    [/医生|护士|医疗|健康|营养|养生|运动康复/, '健康养生'],
    [/企业|创业|经营|老板|管理|生意/, '创业经营'],
    [/会计|财务|审计|税务|金融从业/, '财务常识'],
    [/职场|职业|转型|转行|人力|HR/, '职场成长'],
    [/律师|法律|法务/, '法律常识'],
    [/互联网|科技|产品经理|程序|工程师|IT/, '科技职场'],
    [/高尔夫/, '高尔夫'], [/网球/, '网球'], [/骑行|自行车/, '骑行'], [/滑雪/, '滑雪'],
    [/健身|运动|羽毛球|游泳|瑜伽|篮球|足球/, '运动健身'], [/旅行|旅游/, '旅行'],
    [/汽车|自驾/, '汽车'], [/摄影|拍照/, '摄影'], [/户外|露营|徒步|登山/, '户外'],
    [/跑步|马拉松/, '跑步'], [/读书|阅读/, '读书'], [/美食|烹饪|做饭|餐饮/, '美食'],
    [/宠物|猫|狗/, '宠物'], [/影视|电影|追剧/, '影视娱乐'],
  ];

  function text(v) { return String(v || '').trim(); }
  function split(v) { return text(v).split(/[｜|、,，;；/\n]+/).map((x) => x.trim()).filter(Boolean); }
  function firstByKey(profile, patterns) {
    for (const [key, value] of Object.entries(profile || {})) {
      if (patterns.some((pattern) => pattern.test(key)) && text(value)) return text(value);
    }
    return '';
  }
  function normalizeSignupFields(profile) {
    if (!profile || typeof profile !== 'object') return profile;
    if (!text(profile.selfIntro)) profile.selfIntro = firstByKey(profile, [/^自我介绍$/, /简单的自我介绍/, /更了解您做自媒体的优势/]);
    if (!text(profile.purpose)) profile.purpose = firstByKey(profile, [/做自媒体.*目的/, /自媒体.*目的/]);
    if (!text(profile.city)) profile.city = firstByKey(profile, [/所在城市/, /主要服务.*城市/]);
    return profile;
  }

  const SOURCE_FIELDS = [
    ['lifeRoles', '家庭与生活身份', 10],
    ['previousCareer', '过往职业/经历', 9],
    ['selfIntro', '报名自我介绍', 8],
    ['generationNotes', '口头补充', 8],
    ['strengths', '个人优势', 7], ['expertise', '专业积累', 7], ['specialties', '专业积累', 7],
    ['services', '服务资料', 6], ['serviceAreas', '服务资料', 6], ['serviceCapabilities', '服务资料', 6],
    ['customerGroups', '服务人群', 5],
    ['hobbies', '个人爱好', 5],
  ];
  function mappedDirections(value) {
    const result = [];
    MAP.forEach(([pattern, direction]) => { if (pattern.test(value) && !result.includes(direction)) result.push(direction); });
    return result;
  }
  function collect(profile = {}) {
    normalizeSignupFields(profile);
    const candidates = new Map();
    function add(direction, source, evidence, weight) {
      if (!direction) return;
      const item = candidates.get(direction) || { direction, sources: [], evidence: [], evidenceStrength: 0 };
      if (!item.sources.includes(source)) item.sources.push(source);
      if (evidence && !item.evidence.includes(evidence)) item.evidence.push(evidence);
      item.evidenceStrength += weight;
      candidates.set(direction, item);
    }
    SOURCE_FIELDS.forEach(([key, source, weight]) => {
      split(profile[key]).forEach((value) => mappedDirections(value).forEach((direction) => add(direction, source, value, weight)));
    });
    const peer = profile.peerReviewSummary || {};
    (peer.topTopics || []).forEach((item) => mappedDirections(text(item?.label)).forEach((direction) => add(direction, '身边人反馈', text(item?.label), Math.min(8, Number(item?.count || 1) + 3))));
    (peer.topRoles || []).forEach((item) => mappedDirections(text(item?.label)).forEach((direction) => add(direction, '身边人反馈', text(item?.label), Math.min(7, Number(item?.count || 1) + 2))));
    return [...candidates.values()].map((item) => ({
      ...item,
      baseScore: BASE[item.direction] || 50,
      score: (BASE[item.direction] || 50) + Math.min(24, item.evidenceStrength),
    })).sort((a, b) => b.score - a.score || b.evidenceStrength - a.evidenceStrength || b.baseScore - a.baseScore);
  }

  window.rankIpContentBranches = collect;
  const previousBuild = window.buildIpContentStrategy;
  if (typeof previousBuild === 'function') {
    window.buildIpContentStrategy = function buildIpContentStrategyV26(profile = {}, proposal = {}) {
      normalizeSignupFields(profile);
      const strategy = previousBuild(profile, proposal);
      const ranked = collect(profile);
      strategy.contentBranchRanking = ranked;
      const general = (strategy.lines || []).find((line) => line.kind === 'general');
      if (general) {
        const best = ranked[0];
        if (best) {
          general.title = `内容支线 · ${best.direction}`;
          general.directions = [best.direction];
          general.collections = [best.direction];
          general.source = best.sources.join(' + ');
          general.ranking = ranked;
          general.empty = false;
        } else {
          general.title = '内容支线 · 暂未确定'; general.directions = []; general.collections = [];
          general.source = ''; general.ranking = []; general.empty = true;
        }
      }
      return strategy;
    };
  }

  if (typeof startWorkspace === 'function') {
    const baseStart = startWorkspace;
    startWorkspace = function startWorkspaceV26(profile, matched, history = [], proposals = [], planningHistory = [], contentPlans = [], creativeHistory = []) {
      normalizeSignupFields(profile);
      return baseStart(profile, matched, history, proposals, planningHistory, contentPlans, creativeHistory);
    };
  }

  function ensureSignupIntro() {
    const card = document.getElementById('profile-card');
    const intro = text(state.profile?.selfIntro);
    if (!card || !intro) return;
    card.querySelector('[data-signup-intro="1"]')?.remove();
    const group = document.createElement('div'); group.className = 'profile-group'; group.dataset.signupIntro = '1';
    const label = document.createElement('span'); label.className = 'profile-label'; label.textContent = '报名自我介绍';
    const value = document.createElement('div'); value.className = 'profile-value profile-long-value'; value.textContent = intro;
    group.append(label, value); card.appendChild(group);
  }
  if (typeof renderProfile === 'function') {
    const baseRender = renderProfile;
    renderProfile = function renderProfileV26() {
      normalizeSignupFields(state.profile || {});
      const result = baseRender();
      ensureSignupIntro();
      return result;
    };
  }

  window.aiaContentBranchEvidenceV26 = { collect, normalizeSignupFields };
})();
