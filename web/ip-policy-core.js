// IP Policy Core — 单一规则源。
// 目标：拓客/增员、内容主线、简介、一句话定位、合规尾部只在这里定义；禁止再新增 Vxx 覆盖层。
(function () {
  'use strict';
  const text = v => String(v ?? '').trim();
  const uniq = xs => [...new Set((xs || []).filter(Boolean))];
  const split = v => text(v).split(/[｜|、,，;；/\n]+/).map(x => x.trim()).filter(Boolean);

  const PRIMARY_GOALS = Object.freeze({ CUSTOMER: 'customer_acquisition', RECRUITMENT: 'recruitment' });
  const INSURANCE_MAINLINES = Object.freeze([
    '家庭保障','重疾保障','医疗保障','养老规划','财富规划','教育规划','保险知识','增员与职业发展'
  ]);
  const SECONDARY_ONLY = Object.freeze([
    '养生','美食','读书','阅读','旅行','旅游','智能家居','家居改造','运动','健身','跑步','骑行','摄影','户外','育儿生活'
  ]);

  function inferPrimaryGoal(profile) {
    const explicit = text(profile?.primaryGoal);
    if (Object.values(PRIMARY_GOALS).includes(explicit)) return explicit;
    const raw = text(profile?.purpose);
    const recruit = /增员|招募|团队/.test(raw);
    const customer = /拓客|获客|客户/.test(raw);
    // 只有唯一明确时才能自动归一；两者都要、打造专业形象等必须追问。
    if (recruit && !customer) return PRIMARY_GOALS.RECRUITMENT;
    if (customer && !recruit) return PRIMARY_GOALS.CUSTOMER;
    return '';
  }

  function needsGoalClarification(profile) { return !inferPrimaryGoal(profile); }
  function applyPrimaryGoal(profile, goal) {
    if (!profile || !Object.values(PRIMARY_GOALS).includes(goal)) return false;
    profile.primaryGoal = goal;
    return true;
  }

  function goalQuestion() {
    return {
      key: 'primaryGoal',
      label: '账号优先目标',
      ask: '如果现阶段只能优先做好一件事，你更希望这个账号帮你：',
      chips: ['吸引潜在客户', '吸引潜在增员对象'],
      required: true
    };
  }

  function normalizedMainlines(profile, proposal) {
    const goal = inferPrimaryGoal(profile);
    if (goal === PRIMARY_GOALS.RECRUITMENT) return ['增员与职业发展'];
    const raw = [proposal?.contentMainline, proposal?.mainline, ...(proposal?.contentDirections || []), profile?.services, profile?.expertise]
      .flatMap(split).join(' ');
    const matched = INSURANCE_MAINLINES.filter(x => raw.includes(x) && x !== '增员与职业发展');
    return matched.length ? matched.slice(0, 3) : ['家庭保障', '养老规划', '保险知识'];
  }

  function secondaryTopics(profile) {
    const raw = [profile?.hobbies, profile?.selfIntro, profile?.contentPreferences].map(text).join(' ');
    return SECONDARY_ONLY.filter(x => raw.includes(x)).slice(0, 4);
  }

  function familyIdentity(p) {
    const s = [p?.lifeRoles,p?.familyIdentity,p?.selfIntro].map(text).join(' ');
    for (const x of ['二孩宝妈','二宝妈妈','二孩妈妈','二宝爸','二孩爸爸','宝妈','宝爸']) if (s.includes(x)) return x;
    return '';
  }
  function career(p) {
    const direct = split(p?.previousCareer)[0];
    if (direct) return direct;
    const s = text(p?.selfIntro);
    for (const x of ['环保工程师','工程师','教师','医生','律师','HR','财务','银行从业者','创业者','会计','记者','主持人','程序员']) if (s.includes(x)) return x;
    return '';
  }
  function proofs(p) {
    const out = [];
    const edu = [p?.schoolTier,p?.education,p?.overseas].map(text).join(' ');
    if (/博士/.test(edu)) out.push('博士背景'); else if (/硕士/.test(edu)) out.push('硕士背景');
    else if (/985/.test(edu)) out.push('985高校背景'); else if (/211/.test(edu)) out.push('211高校背景');
    else if (/QS\s*前?\s*100/i.test(edu)) out.push('QS前100高校背景');
    if (text(p?.insuranceYears)) out.push(`${text(p.insuranceYears).replace(/年$/,'')}年从业经历`);
    const honor = split(p?.honors).find(v => /MDRT|COT|TOT|五星/i.test(v)); if (honor) out.push(honor);
    return uniq(out).slice(0,2);
  }
  function feedback(p) {
    const items = p?.peerReviewSummary?.topTraits || p?.peerReviewSummary?.topImpressions || [];
    return uniq(items.filter(i => Number(i?.count || 1) >= 2).map(i => text(i?.label ?? i))).slice(0,2);
  }
  function services(p) {
    return uniq(['services','serviceAreas','serviceCapabilities','expertise','specialties'].flatMap(k => split(p?.[k]))).slice(0,4);
  }

  function headline(profile) {
    const job = career(profile), family = familyIdentity(profile), proof = proofs(profile)[0];
    // 不带称呼；保险/家庭长期规划必须是主内容。
    if (job) return `从${job}跨界，用自己的经验讲清家庭保障与长期规划`;
    if (family) return `从${family}视角，分享家庭保障与长期规划的实用经验`;
    if (proof) return `带着${proof}的专业底色，讲清家庭保障与长期规划`;
    return '围绕家庭保障与长期规划，分享真实、实用、听得懂的内容';
  }

  const XHS_BANNED = /保险|金融|理财|贷款|股票|基金|医疗|护理|教育|玄学|友邦|\bAIA\b|微信|手机号|电话|QQ|二维码|私信|稳赚|无风险|财富自由/i;
  const VIDEO_DISCLAIMER = '📌 本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见。';
  const XHS_DISCLAIMER = '📌 本账号所述内容为个人意见，不代表任何官方意见。';
  function safeXhs(v) { return text(v) && !XHS_BANNED.test(text(v)); }

  function bioBody(profile, platform, variant) {
    const id = [familyIdentity(profile), career(profile) ? `曾从事${career(profile)}` : ''].filter(Boolean).join('，');
    const ps = proofs(profile), fs = feedback(profile), ss = services(profile);
    const main = platform === 'xhs' ? '分享家庭保障、养老准备与长期规划相关内容' : '分享保险、家庭保障、养老与长期规划相关内容';
    let lines;
    if (variant === 'memory') lines = [id, fs.length ? `客户常提到：${fs.join('、')}` : '', ps[0] || '', main];
    else if (variant === 'service') lines = [id, ss.length ? ss.join('｜') : '', main, ps.join('｜')];
    else lines = [id, ps.join('｜'), main, fs.length ? `客户常提到：${fs.join('、')}` : ''];
    lines = uniq(lines.map(text).filter(Boolean));
    if (platform === 'xhs') lines = lines.filter(safeXhs);
    return lines;
  }

  // 合规尾部是唯一允许输出机构/执业编号/声明的位置。
  function complianceFooter(profile, platform) {
    if (platform === 'xhs') return [XHS_DISCLAIMER];
    const out = [];
    if (text(profile?.department)) out.push(`📍 ${text(profile.department)}`);
    const license = text(profile?.licenseNumber || profile?.agentId || profile?.agent_id);
    if (license) out.push(`📌 执业编号：${license}`);
    out.push(VIDEO_DISCLAIMER);
    return out;
  }

  function buildBios(profile, platform) {
    const defs = [['方案 A · 专业背书','proof'],['方案 B · 人设记忆','memory'],['方案 C · 价值服务','service']];
    return defs.map(([label, variant]) => ({
      label,
      focus: variant === 'proof' ? '我是谁 + 为什么值得相信' : variant === 'memory' ? '让别人先记住这个人' : '我能给你带来什么',
      lines: [...bioBody(profile, platform, variant), ...complianceFooter(profile, platform)]
    }));
  }

  function enforceProposal(proposal, profile) {
    if (!proposal) return proposal;
    proposal.headline = headline(profile || {});
    proposal.primaryGoal = inferPrimaryGoal(profile || {});
    proposal.contentMainline = normalizedMainlines(profile || {}, proposal);
    proposal.secondaryContent = secondaryTopics(profile || {});
    proposal.bios = proposal.bios || {};
    proposal.bios.xiaohongshu = buildBios(profile || {}, 'xhs');
    proposal.bios.videoDouyin = buildBios(profile || {}, 'video');
    return proposal;
  }

  // 76：在进入后续 IP 问题前插入唯一目标确认题。
  function installGoalGate() {
    if (typeof questions === 'undefined' || !Array.isArray(questions)) return;
    if (!questions.some(q => q.key === 'primaryGoal')) questions.unshift(goalQuestion());
    const q = questions.find(q => q.key === 'primaryGoal');
    if (q) Object.assign(q, goalQuestion());
  }

  installGoalGate();
  const basePresent = typeof presentQuestion === 'function' ? presentQuestion : null;
  if (basePresent) presentQuestion = function ipPolicyPresentQuestion(...args) {
    installGoalGate();
    return basePresent.apply(this, args);
  };
  const baseRender = typeof renderProposal === 'function' ? renderProposal : null;
  if (baseRender) renderProposal = function ipPolicyRenderProposal(proposal, version) {
    enforceProposal(proposal, state.profile || {});
    return baseRender.call(this, proposal, version);
  };

  window.aiaIpPolicy = Object.freeze({
    PRIMARY_GOALS, INSURANCE_MAINLINES, SECONDARY_ONLY,
    inferPrimaryGoal, needsGoalClarification, applyPrimaryGoal, goalQuestion,
    normalizedMainlines, secondaryTopics, headline, bioBody, complianceFooter, buildBios, enforceProposal
  });
})();
