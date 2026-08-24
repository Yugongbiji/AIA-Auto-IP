// IP Policy Core — IP 核心业务规则的唯一 owner。
// 负责：最终目标、内容主线/支线、一句话定位、简介主体、合规尾部。
// 其他 Vxx 文件只能做 UI/兼容/数据标准化，不得重复写这些输出。
(function () {
  'use strict';
  const text = v => String(v ?? '').trim();
  const split = v => text(v).split(/[｜|、,，;；/\n]+/).map(x => x.trim()).filter(Boolean);
  const uniq = xs => [...new Set((xs || []).filter(Boolean))];
  const OMIT = /^(其他|其它|不希望填写|跳过|暂不填写|不愿填写|不想填写)$/;

  const PRIMARY_GOALS = Object.freeze({ CUSTOMER: 'customer_acquisition', RECRUITMENT: 'recruitment' });
  const CUSTOMER_MAINLINES = Object.freeze(['家庭保障','重疾保障','医疗保障','养老规划','财富规划','教育规划','保险知识']);
  const RECRUITMENT_MAINLINES = Object.freeze(['增员与职业发展']);
  const SECONDARY_ONLY = Object.freeze(['育儿','升学教育','健康养生','创业经营','财务常识','职场成长','法律常识','科技职场','高尔夫','网球','骑行','滑雪','运动健身','旅行','汽车','摄影','户外','跑步','读书','美食','宠物','影视娱乐','智能家居','家居改造','生活日常']);

  function normalizeGoalValue(value) {
    const raw = text(value);
    if (!raw) return '';
    if (raw === PRIMARY_GOALS.CUSTOMER || /^(拓客|获客|吸引潜在客户|拓客为主)$/.test(raw)) return PRIMARY_GOALS.CUSTOMER;
    if (raw === PRIMARY_GOALS.RECRUITMENT || /^(增员|招募|吸引潜在增员对象|增员为主)$/.test(raw)) return PRIMARY_GOALS.RECRUITMENT;
    return '';
  }
  function inferPrimaryGoal(profile) {
    const explicit = normalizeGoalValue(profile?.primaryGoal);
    if (explicit) return explicit;
    const raw = text(profile?.purpose);
    const recruit = /增员|招募|团队/.test(raw);
    const customer = /拓客|获客|客户/.test(raw);
    if (recruit && !customer && !/都要|两者|兼顾|同时|一起/.test(raw)) return PRIMARY_GOALS.RECRUITMENT;
    if (customer && !recruit && !/都要|两者|兼顾|同时|一起/.test(raw)) return PRIMARY_GOALS.CUSTOMER;
    return '';
  }
  function needsGoalClarification(profile) { return !inferPrimaryGoal(profile); }
  function applyPrimaryGoal(profile, goal) {
    const normalized = normalizeGoalValue(goal);
    if (!profile || !normalized) return false;
    profile.primaryGoal = normalized;
    return true;
  }
  function goalQuestion() {
    return {
      key: 'primaryGoal', label: '账号优先目标', required: true, multiple: false,
      ask: '刚刚起号阶段，建议先从“拓客”和“增员”里选一个方向，不要贪多。先把一个方向做清楚，等账号运营成熟后再拓展另一个方向。现阶段你更希望这个账号优先帮你：',
      chips: ['吸引潜在客户', '吸引潜在增员对象']
    };
  }

  function cleanQuestionOptions() {
    if (!Array.isArray(questions)) return;
    questions.forEach(q => { if (Array.isArray(q.chips)) q.chips = q.chips.filter(x => !OMIT.test(text(x))); });
  }
  function installGoalGate() {
    if (!Array.isArray(questions)) return;
    cleanQuestionOptions();
    const oldPurposeIndex = questions.findIndex(q => q.key === 'purpose');
    if (oldPurposeIndex >= 0) questions.splice(oldPurposeIndex, 1);
    let q = questions.find(item => item.key === 'primaryGoal');
    if (!q) { q = goalQuestion(); const agentIndex=questions.findIndex(item=>item.key==='agentId'); questions.splice(agentIndex>=0?agentIndex+1:0,0,q); }
    else Object.assign(q, goalQuestion());
  }

  function prepareProfileGoal(profile) {
    if (!profile || typeof profile !== 'object') return profile;
    const normalized = inferPrimaryGoal(profile);
    if (normalized) profile.primaryGoal = normalized;
    else delete profile.primaryGoal;
    return profile;
  }

  function normalizedMainlines(profile, proposal) {
    const goal = inferPrimaryGoal(profile);
    if (goal === PRIMARY_GOALS.RECRUITMENT) return [...RECRUITMENT_MAINLINES];
    const evidence = [proposal?.contentMainline, proposal?.mainline, proposal?.contentDirections, profile?.services, profile?.serviceAreas, profile?.serviceCapabilities, profile?.expertise, profile?.specialties].flatMap(split).join(' ');
    const matched = CUSTOMER_MAINLINES.filter(x => evidence.includes(x));
    return matched.length ? matched.slice(0, 3) : ['家庭保障','养老规划','保险知识'];
  }

  function secondaryTopics(profile) {
    const ranked = typeof window.rankIpContentBranches === 'function' ? window.rankIpContentBranches(profile || {}) : [];
    const valid = ranked.filter(item => SECONDARY_ONLY.includes(text(item?.direction)));
    const best = valid[0];
    if (best) return { topics:[best.direction], source:(best.sources||[]).join(' + '), ranking:valid };
    const raw=[profile?.hobbies,profile?.lifeRoles,profile?.previousCareer,profile?.selfIntro,profile?.contentPreferences].map(text).join(' ');
    const fallback = SECONDARY_ONLY.find(x => raw.includes(x));
    return { topics:fallback?[fallback]:[], source:fallback?'已有个人资料':'', ranking:[] };
  }

  function familyIdentity(profile) {
    const s=[profile?.lifeRoles,profile?.familyIdentity,profile?.selfIntro].map(text).join(' ');
    for (const item of ['二孩宝妈','二宝妈妈','二孩妈妈','二孩宝爸','二宝爸','二孩爸爸','宝妈','宝爸']) if (s.includes(item)) return item;
    return '';
  }
  function career(profile) {
    const direct=split(profile?.previousCareer)[0]; if (direct) return direct;
    const s=text(profile?.selfIntro);
    for (const item of ['环保工程师','工程师','教师','医生','律师','HR','财务','银行从业者','创业者','会计','记者','主持人','程序员']) if (s.includes(item)) return item;
    return '';
  }
  function proofs(profile) {
    const out=[]; const edu=[profile?.schoolTier,profile?.education,profile?.overseas].map(text).join(' ');
    if (/博士/.test(edu)) out.push('博士背景'); else if (/硕士/.test(edu)) out.push('硕士背景'); else if (/985/.test(edu)) out.push('985高校背景'); else if (/211/.test(edu)) out.push('211高校背景'); else if (/QS\s*前?\s*100/i.test(edu)) out.push('QS前100高校背景');
    if (text(profile?.insuranceYears)) out.push(`${text(profile.insuranceYears).replace(/年$/,'')}年从业经历`);
    const honor=split(profile?.honors).find(v=>/MDRT|COT|TOT|五星/i.test(v)); if(honor) out.push(honor);
    return uniq(out).slice(0,2);
  }
  function feedback(profile) {
    const items=profile?.peerReviewSummary?.topTraits||profile?.peerReviewSummary?.topImpressions||[];
    return uniq(items.filter(i=>Number(i?.count||1)>=2).map(i=>text(i?.label??i))).slice(0,2);
  }
  function serviceLabels(profile) {
    const evidence=['services','serviceAreas','serviceCapabilities','expertise','specialties'].flatMap(k=>split(profile?.[k])).join('｜');
    if (!evidence) return [];
    const rules=[[/养老|退休/,'养老规划'],[/教育金|子女教育/,'教育规划'],[/财富|资产配置|传承/,'财富规划'],[/家庭保障|家庭保险/,'家庭保障'],[/重疾|医疗|健康保障/,'健康规划'],[/企业主|企业保障|团险/,'企业保障'],[/理赔/,'理赔协助'],[/保单检视|保单整理|保单分析/,'保单检视'],[/保障规划|保险规划|风险保障/,'保障规划']];
    return uniq(rules.filter(([p])=>p.test(evidence)).map(([,label])=>label)).slice(0,4);
  }

  function headline(profile) {
    const goal=inferPrimaryGoal(profile); const job=career(profile), family=familyIdentity(profile), proof=proofs(profile)[0];
    if (goal===PRIMARY_GOALS.RECRUITMENT) {
      if (job) return `从${job}跨界，分享职业转型与长期成长的真实经验`;
      if (proof) return `带着${proof}的专业底色，分享职业选择与长期成长`;
      return '分享职业选择、真实转型与长期成长的经验和思考';
    }
    if (job) return `从${job}跨界，用自己的经验讲清家庭保障与长期规划`;
    if (family) return `从${family}视角，分享家庭保障与长期规划的实用经验`;
    if (proof) return `带着${proof}的专业底色，讲清家庭保障与长期规划`;
    return '围绕家庭保障与长期规划，分享真实、实用、听得懂的内容';
  }

  const XHS_BANNED=/保险|金融|理财|贷款|股票|基金|医疗|护理|教育|玄学|友邦|\bAIA\b|微信|手机号|电话|QQ|二维码|私信|稳赚|无风险|财富自由/i;
  const VIDEO_DISCLAIMER='本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见';
  const XHS_DISCLAIMER='本账号所述内容为个人意见，不代表任何官方意见。';
  function safeXhs(v){return text(v)&&!XHS_BANNED.test(text(v));}
  function identityLine(profile){const family=familyIdentity(profile),job=career(profile);if(family&&job)return `${family}，曾从事${job}`;return family || (job?`曾从事${job}`:'');}
  function mainBioLine(profile,platform){const recruitment=inferPrimaryGoal(profile)===PRIMARY_GOALS.RECRUITMENT;if(recruitment)return platform==='xhs'?'分享职业选择、成长与长期主义相关内容':'分享职业选择、转型成长与团队真实经验';return platform==='xhs'?'分享家庭保障、养老准备与长期规划相关内容':'分享保险、家庭保障、养老与长期规划相关内容';}
  function emojiLine(emoji,value){const v=text(value);return v?`${emoji} ${v}`:'';}
  function bioBody(profile,platform,variant){
    const id=identityLine(profile), ps=proofs(profile), fs=feedback(profile), ss=serviceLabels(profile), main=mainBioLine(profile,platform); let lines=[];
    if(variant==='memory') lines=[emojiLine('👤',id),emojiLine('💬',main),fs.length?emojiLine('✨',`客户常提到：${fs.join('、')}`):'',ps[0]?emojiLine('🏅',ps[0]):''];
    else if(variant==='service') lines=[emojiLine('👤',id),emojiLine('💬',main),ss.length?emojiLine('🧭',ss.join('｜')):'',ps[0]?emojiLine('🏅',ps[0]):''];
    else lines=[emojiLine('👤',id),ps.length?emojiLine('🏅',ps.join('｜')):'',emojiLine('💬',main),fs.length?emojiLine('✨',`客户常提到：${fs.join('、')}`):''];
    lines=uniq(lines.map(text).filter(Boolean));
    if(platform==='xhs') lines=lines.filter(safeXhs);
    return lines;
  }
  function explicitLicense(profile){
    const direct=text(profile?.licenseNumber||profile?.practiceLicense||profile?.licenseNo||profile?.['执业证编号']||profile?.['执业编号']);
    return direct;
  }
  function complianceFooter(profile,platform){
    if(platform==='xhs') return [XHS_DISCLAIMER];
    const out=[VIDEO_DISCLAIMER];
    const department=text(profile?.department); if(department) out.push(`营销服务部：${department}`); else out.push('营销服务部：待补充');
    const license=explicitLicense(profile); out.push(`执业证编号：${license||'000'}`);
    return out;
  }
  function buildBios(profile,platform){
    const defs=[['方案 A · 专业背书','proof'],['方案 B · 人设记忆','memory'],['方案 C · 价值服务','service']];
    return defs.map(([label,variant])=>({label,focus:variant==='proof'?'我是谁 + 为什么值得相信':variant==='memory'?'让别人先记住这个人':'我能给你带来什么',lines:[...bioBody(profile,platform,variant),...complianceFooter(profile,platform)]}));
  }

  function enforceProposal(proposal,profile){
    if(!proposal)return proposal;
    const branch=secondaryTopics(profile||{});
    proposal.headline=headline(profile||{});
    proposal.primaryGoal=inferPrimaryGoal(profile||{});
    proposal.contentMainline=normalizedMainlines(profile||{},proposal);
    proposal.secondaryContent=branch.topics;
    proposal.secondaryContentSource=branch.source;
    proposal.secondaryContentRanking=branch.ranking;
    proposal.bios=proposal.bios||{};
    proposal.bios.xiaohongshu=buildBios(profile||{},'xhs');
    proposal.bios.videoDouyin=buildBios(profile||{},'video');
    return proposal;
  }

  installGoalGate();
  if (typeof startWorkspace==='function') { const base=startWorkspace; startWorkspace=function ipPolicyStartWorkspace(profile,...rest){prepareProfileGoal(profile);installGoalGate();return base(profile,...rest);}; }
  if (typeof presentQuestion==='function') { const base=presentQuestion; presentQuestion=function ipPolicyPresentQuestion(...args){installGoalGate();return base.apply(this,args);}; }
  if (typeof renderProposal==='function') { const base=renderProposal; renderProposal=function ipPolicyRenderProposal(proposal,version){enforceProposal(proposal,state.profile||{});return base.call(this,proposal,version);}; }

  window.aiaIpPolicy=Object.freeze({PRIMARY_GOALS,CUSTOMER_MAINLINES,RECRUITMENT_MAINLINES,SECONDARY_ONLY,normalizeGoalValue,inferPrimaryGoal,needsGoalClarification,applyPrimaryGoal,goalQuestion,normalizedMainlines,secondaryTopics,headline,bioBody,complianceFooter,buildBios,enforceProposal,prepareProfileGoal});
})();
