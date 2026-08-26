// 产品规则 V14：内容支线候选识别与业务价值排序。
// 只提供候选与排序；最终 secondaryContent 由 ip-policy-core.js 唯一写入。
(function () {
  'use strict';
  function insertBeforeDepartment(question) {
    if (!Array.isArray(questions) || questions.some((item) => item.key === question.key)) return;
    const departmentIndex = questions.findIndex((item) => item.key === 'department');
    questions.splice(departmentIndex >= 0 ? departmentIndex : questions.length, 0, question);
  }

  insertBeforeDepartment({ key: 'previousCareer', label: '过往职业/经历', ask: '你过去做过什么工作，或有哪些比较有代表性的长期经历？这类真实积累也可以帮助确定内容支线。可多选，也可以自己补充。', chips: ['教育/教师', '医疗健康', '法律', '财务/会计', '互联网/科技', '企业经营'], multiple: true });
  insertBeforeDepartment({ key: 'lifeRoles', label: '家庭与生活身份', ask: '除了保险从业者之外，你还有哪些长期身份？比如宝爸宝妈、创业者等。真实身份也可以帮助确定内容支线。可多选，也可以自己补充。', chips: ['宝爸', '宝妈', '创业者', '职场人'], multiple: true });
  insertBeforeDepartment({ key: 'hobbies', label: '个人爱好', ask: '你有哪些真正长期在做、愿意持续分享的爱好？这些也可以成为内容支线。可多选，也可以自己补充。', chips: ['运动健身', '骑行', '跑步', '户外', '旅行', '摄影', '读书', '美食', '育儿'], multiple: true });
  if (typeof labels !== 'undefined') { labels.previousCareer = '过往职业/经历'; labels.lifeRoles = '家庭与生活身份'; labels.hobbies = '个人爱好'; }

  const BASE_SCORES = Object.freeze({
    '育儿': 90, '升学教育': 88, '健康养生': 86, '家庭照护': 86, '创业经营': 85, '财务常识': 84,
    '职场成长': 80, '法律常识': 78, '高尔夫': 78, '网球': 74, '骑行': 72, '滑雪': 72,
    '科技职场': 72, '运动健身': 70, '旅行': 68, '汽车': 68, '摄影': 64, '户外': 64, '跑步': 63,
    '读书': 62, '美食': 55, '宠物': 54, '影视娱乐': 48, '生活日常': 45,
  });
  const RULES = [
    [/宝爸|宝妈|父母|带娃|育儿|亲子/, '育儿'], [/教师|教育|学校|升学|培训/, '升学教育'],
    [/医生|护士|医疗|健康|药|营养|养生/, '健康养生'], [/照护父母|养老照护/, '家庭照护'],
    [/企业|创业|经营|老板|管理/, '创业经营'], [/会计|财务|审计|税务/, '财务常识'],
    [/职场|职业转型/, '职场成长'], [/律师|法律|法务/, '法律常识'], [/互联网|科技|产品|程序|工程师/, '科技职场'],
    [/高尔夫/, '高尔夫'], [/网球/, '网球'], [/骑行/, '骑行'], [/滑雪/, '滑雪'],
    [/健身|运动|羽毛球|游泳/, '运动健身'], [/旅行|旅游/, '旅行'], [/汽车|自驾/, '汽车'],
    [/摄影/, '摄影'], [/户外|露营|徒步/, '户外'], [/跑步/, '跑步'], [/读书|阅读/, '读书'],
    [/美食|烹饪|做饭/, '美食'], [/宠物|猫|狗/, '宠物'], [/影视|电影|追剧/, '影视娱乐'],
  ];
  const RECRUITMENT_BONUS = Object.freeze({ '职场成长':8, '创业经营':6, '科技职场':5, '个人成长':5, '法律常识':2 });
  const CUSTOMER_BONUS = Object.freeze({ '育儿':6, '升学教育':5, '健康养生':5, '家庭照护':5, '财务常识':4, '创业经营':3 });

  function text(v){return String(v??'').trim();}
  function splitValues(value) { return text(value).split(/[｜|、,，;；/\n]+/).map((item) => item.trim()).filter(Boolean); }
  function matches(value) { const found=[]; RULES.forEach(([pattern,direction])=>{ if(pattern.test(value) && !found.includes(direction)) found.push(direction); }); return found; }
  function unknownDirection(value) {
    const cleaned=text(value).replace(/^(喜欢|爱好|长期|经常|擅长|从事|做过)/,'').trim();
    if (!cleaned || cleaned.length > 12 || /保险|友邦|AIA|客户|服务/.test(cleaned)) return '';
    return cleaned;
  }
  function collectCandidates(profile = {}) {
    const candidates = new Map();
    function add(direction, source, evidence, strength) {
      if (!direction) return;
      const current = candidates.get(direction) || { direction, sources: [], evidence: [], evidenceStrength: 0, evidenceScore:0 };
      if (!current.sources.includes(source)) current.sources.push(source);
      if (evidence && !current.evidence.includes(evidence)) { current.evidence.push(evidence); current.evidenceScore += strength || 0; }
      current.evidenceStrength = Math.max(current.evidenceStrength, strength || 0);
      candidates.set(direction, current);
    }
    [['previousCareer','过往职业/经历',8],['lifeRoles','家庭与生活身份',8],['hobbies','个人爱好',4]].forEach(([key,source,strength]) => splitValues(profile[key]).forEach(value => {
      const mapped=matches(value); if(mapped.length)mapped.forEach(direction => add(direction,source,value,strength)); else { const unknown=unknownDirection(value); if(unknown)add(unknown,source,value,strength); }
    }));
    const legacy=[profile.selfIntro,profile.strengths,profile.services,profile.expertise,profile.specialties,profile.contentPreferences].filter(Boolean).join('｜');
    matches(legacy).forEach(direction=>add(direction,'已有个人资料',legacy,5));
    const peer=[...(profile.peerReviewSummary?.topTopics||[]),...(profile.peerReviewSummary?.topRoles||[])].map(x=>String(x?.label??x)).join('｜');
    matches(peer).forEach(direction=>add(direction,'客户反馈',peer,6));
    const goal=String(profile.primaryGoal||''); const bonusMap=goal==='recruitment'?RECRUITMENT_BONUS:CUSTOMER_BONUS;
    return [...candidates.values()].map(candidate=>{
      const baseScore=BASE_SCORES[candidate.direction]||50;
      const multiSourceBonus=Math.max(0,candidate.sources.length-1)*3;
      const goalBonus=bonusMap[candidate.direction]||0;
      return {...candidate,baseScore,goalBonus,multiSourceBonus,score:baseScore+Math.min(candidate.evidenceScore,18)+multiSourceBonus+goalBonus};
    }).sort((a,b)=>b.score-a.score||b.sources.length-a.sources.length||b.evidenceStrength-a.evidenceStrength||a.direction.localeCompare(b.direction,'zh-CN'));
  }

  window.rankIpContentBranches = collectCandidates;
  window.aiaContentBranchRulesV14 = Object.freeze({ BASE_SCORES, collectCandidates, ownsFinalOutput:false });
})();
