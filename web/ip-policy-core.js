// IP Policy Core — IP 核心业务规则的唯一 owner。
// 负责：最终目标、目标人群语义、方案定位/画像/优势、内容主线/支线、简介主体与合规尾部。
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
  const SECONDARY_ONLY = Object.freeze(['育儿','升学教育','健康养生','家庭照护','创业经营','财务常识','职场成长','法律常识','科技职场','高尔夫','网球','骑行','滑雪','运动健身','旅行','汽车','摄影','户外','跑步','读书','美食','宠物','影视娱乐','智能家居','家居改造','生活日常']);

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
    syncGoalDependentQuestions(profile);
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
  function findAudienceQuestion(kind) {
    return questions.find(q => q.__aiaAudienceKind === kind) || questions.find(q => kind==='groups' ? ['customerGroups','recruitmentGroups'].includes(q.key) : ['customerAges','recruitmentAges'].includes(q.key));
  }
  function syncGoalDependentQuestions(profile) {
    if (!Array.isArray(questions)) return;
    const goal=inferPrimaryGoal(profile||{});
    if (goal) profile.primaryGoal=goal;
    const groups=findAudienceQuestion('groups'); const ages=findAudienceQuestion('ages');
    if(groups){groups.__aiaAudienceKind='groups';if(goal===PRIMARY_GOALS.RECRUITMENT){groups.key='recruitmentGroups';groups.label='准增员对象';groups.ask='你更希望吸引哪些类型的准增员对象？可多选，也可以自行补充。';groups.chips=['职场白领','自由职业者','创业者/企业主','专业人士','宝爸宝妈','年轻职场人'];}else{groups.key='customerGroups';groups.label='服务人群';groups.ask='你最希望服务哪些人群？可多选；也可以自行输入补充。';groups.chips=['企业主','职场白领','宝爸宝妈','都市银发','自由职业者','新市民'];}}
    if(ages){ages.__aiaAudienceKind='ages';if(goal===PRIMARY_GOALS.RECRUITMENT){ages.key='recruitmentAges';ages.label='准增员年龄段';ages.ask='你更希望吸引的准增员对象主要处在哪些年龄段？可多选。';ages.chips=['22–30 岁','30–40 岁','40–50 岁'];}else{ages.key='customerAges';ages.label='客户年龄段';ages.ask='你的目标客户主要处在哪些年龄段？可多选。';ages.chips=['25–35 岁','35–45 岁','45–55 岁','55 岁以上'];}}
    if(typeof labels!=='undefined'){labels.recruitmentGroups='准增员对象';labels.recruitmentAges='准增员年龄段';labels.customerGroups='服务人群';labels.customerAges='客户年龄段';}
  }

  function prepareProfileGoal(profile) {
    if (!profile || typeof profile !== 'object') return profile;
    const normalized = inferPrimaryGoal(profile);
    if (normalized) profile.primaryGoal = normalized;
    else delete profile.primaryGoal;
    syncGoalDependentQuestions(profile);
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
    const valid = ranked.filter(item => SECONDARY_ONLY.includes(text(item?.direction)) || (!CUSTOMER_MAINLINES.includes(text(item?.direction))&&!RECRUITMENT_MAINLINES.includes(text(item?.direction))));
    const best = valid[0];
    if (best) return { topics:[best.direction], source:(best.sources||[]).join(' + '), ranking:valid };
    const raw=[profile?.hobbies,profile?.lifeRoles,profile?.previousCareer,profile?.selfIntro,profile?.contentPreferences].map(text).join(' ');
    const fallback = SECONDARY_ONLY.find(x => raw.includes(x));
    return { topics:fallback?[fallback]:[], source:fallback?'已有个人资料':'', ranking:[] };
  }

  function familyIdentity(profile) {
    const s=[profile?.lifeRoles,profile?.familyIdentity,profile?.selfIntro].map(text).join(' ');
    for (const item of ['二孩宝妈','二宝妈妈','二孩妈妈','二孩宝爸','二宝爸','二孩爸爸','宝妈','妈妈','宝爸','爸爸']) if (s.includes(item)) return item;
    return '';
  }
  function career(profile) {
    const direct=split(profile?.previousCareer)[0]; if (direct) return direct;
    const s=text(profile?.selfIntro);
    for (const item of ['环保工程师','工程师','教师','老师','医生','律师','HR','财务','银行从业者','创业者','会计','记者','主持人','程序员']) if (s.includes(item)) return item;
    return '';
  }
  function proofs(profile) {
    const out=[]; const edu=[profile?.schoolTier,profile?.education,profile?.overseas].map(text).join(' ');
    if (/博士/.test(edu)) out.push('博士背景'); else if (/硕士/.test(edu)) out.push('硕士背景'); else if (/QS\s*前?\s*50/i.test(edu)) out.push('QS前50高校背景'); else if (/QS\s*前?\s*100/i.test(edu)) out.push('QS前100高校背景'); else if (/985/.test(edu)) out.push('985高校背景'); else if (/211/.test(edu)) out.push('211高校背景'); else if (/留学|海归|海外/.test(edu)) out.push('海外学习经历');
    if (text(profile?.insuranceYears)) out.push(`${text(profile.insuranceYears).replace(/年$/,'')}年从业经历`);
    const honors=split(profile?.honors).filter(v=>/MDRT|COT|TOT|五星|销冠|冠军/i.test(v)); if(honors[0]) out.push(honors[0]);
    return uniq(out).slice(0,3);
  }
  function feedback(profile) {
    const items=profile?.peerReviewSummary?.topTraits||profile?.peerReviewSummary?.topImpressions||[];
    const controlled=/^(靠谱|真诚|细致|有耐心|理性|务实|有温度|温暖|阳光|行动力强|长期主义)$/;
    return uniq(items.filter(i=>Number(i?.count||1)>=2).map(i=>text(i?.label??i)).filter(v=>controlled.test(v))).slice(0,2);
  }
  function serviceLabels(profile) {
    const evidence=['services','serviceAreas','serviceCapabilities','expertise','specialties'].flatMap(k=>split(profile?.[k])).join('｜');
    if (!evidence) return [];
    const rules=[[/养老|退休/,'养老规划'],[/教育金|子女教育/,'教育规划'],[/财富|资产配置|传承/,'财富规划'],[/家庭保障|家庭保险/,'家庭保障'],[/重疾|医疗|健康保障/,'健康规划'],[/企业主|企业保障|团险/,'企业保障'],[/理赔/,'理赔协助'],[/保单检视|保单整理|保单分析/,'保单检视'],[/保障规划|保险规划|风险保障/,'保障规划']];
    return uniq(rules.filter(([p])=>p.test(evidence)).map(([,label])=>label)).slice(0,4);
  }

  function headlineEvidenceText(profile){
    try{return JSON.stringify(profile||{});}catch(_){return [profile?.selfIntro,profile?.previousCareer,profile?.honors,profile?.hobbies].map(text).join(' ');}
  }
  function cleanHeadlineCandidate(profile,value){
    let v=text(value).replace(/[｜|]+/g,'，').replace(/，{2,}/g,'，').replace(/^，+|，+$/g,'');
    if(!v||XHS_BANNED.test(v)||/专家|导师|顾问|权威|顶级|第一|唯一|稳赚|无风险/.test(v))return '';
    if(/是我的标签|是我的专业底色|做一个让人记得住的人/.test(v))return '';
    const personNames=[profile?.name,profile?.preferredName,profile?.nickname,profile?.videoNickname,profile?.xiaohongshuNickname].map(text).filter(Boolean);
    if(personNames.some(name=>name.length>1&&v.includes(name)))return '';
    const evidence=headlineEvidenceText(profile);
    const numbers=v.match(/\d+(?:\.\d+)?/g)||[];
    if(numbers.some(n=>!evidence.includes(n)))return '';
    if(/0人脉/.test(v)&&!/0人脉/.test(evidence))return '';
    if(/擅长/.test(v)&&!/擅长/.test(evidence))return '';
    return v;
  }
  function headlineFallback(profile){
    const careers=bioCareerFacts(profile);const family=familyIdentity(profile);const education=bioEducationFacts(profile);const honors=bioHonorFacts(profile);
    const interests=bioInterestFacts(profile).filter(v=>safeXhs(v)&&!/^(生活日常|家庭照护)$/.test(v));
    const interest=interests[0]||'';
    const careerFact=careers.find(v=>/\d/.test(v))||careers[0]||'';
    const cleanCareer=text(careerFact).replace(/工作经验|工作经历|从业经验|从业经历/g,'').trim();
    if(cleanCareer&&family)return `${cleanCareer}，也是${family}`;
    if(cleanCareer&&education.length)return `${cleanCareer}，${education[0]}`;
    if(cleanCareer&&interest)return `${cleanCareer}，也爱${interest}`;
    if(cleanCareer)return cleanCareer;
    if(family&&interest)return `${family}，也爱${interest}`;
    if(education.length&&honors.length)return `${education[0]}，${honors[0]}`;
    if(family)return `${family}，认真记录真实生活`;
    if(interest)return `爱${interest}，也认真记录生活`;
    if(education.length)return `${education[0]}，保持真实表达`;
    if(honors.length)return `${honors[0]}，保持真实表达`;
    return '真实、清楚、有记忆点，这是我的表达方式';
  }
  function headline(profile,candidate='') {
    const proposed=cleanHeadlineCandidate(profile,candidate);
    if(proposed)return proposed;
    return headlineFallback(profile).replace(/[｜|]+/g,'，');
  }
  function subheadline(profile){return inferPrimaryGoal(profile)===PRIMARY_GOALS.RECRUITMENT?'用真实经历建立信任，持续吸引适合长期发展的同行者':'保险是主内容，真实经历与生活身份帮助建立长期信任';}
  function targetPortrait(profile){
    const recruitment=inferPrimaryGoal(profile)===PRIMARY_GOALS.RECRUITMENT;
    const groups=split(recruitment?profile?.recruitmentGroups:profile?.customerGroups);const ages=split(recruitment?profile?.recruitmentAges:profile?.customerAges);
    const title=recruitment?'🎯 准增员对象':'🎯 目标客户画像';
    const subject=groups.length?groups.join('、'):(recruitment?'尚未明确具体准增员对象':'尚未明确具体服务人群');
    const age=ages.length?`，重点年龄段：${ages.join('、')}`:'';
    return {title,text:`${subject}${age}`};
  }
  function advantageItems(profile){
    const out=[];const add=(emoji,title,value)=>{if(value&&!out.some(x=>x.title===title&&x.text===value))out.push({emoji,title,text:value});};
    const job=career(profile),family=familyIdentity(profile),ps=proofs(profile),traits=feedback(profile),services=serviceLabels(profile);
    add('🧩','真实经历',job?`有${job}相关经历，可形成差异化表达`:'');
    add('👤','生活身份',family?`${family}是长期真实身份，可提供生活化视角`:'');
    if(ps.length)add('🏅','专业背书',ps.slice(0,2).join('｜'));
    if(traits.length)add('💬','他人评价',`多人反馈提到：${traits.join('、')}`);
    if(services.length)add('🧭','真实服务',services.join('｜'));
    if(!out.length)add('✨','真实表达','优先围绕已确认资料持续补充，不凭空创造优势');
    return out.slice(0,4);
  }
  function proposalTags(profile,branch){const goal=inferPrimaryGoal(profile)===PRIMARY_GOALS.RECRUITMENT?'增员':'拓客';return uniq([goal,...(branch?.topics||[]),career(profile)||familyIdentity(profile)]).slice(0,3);}

  const XHS_BANNED=/保险|金融|理财|贷款|股票|基金|医疗|护理|教育|玄学|友邦|\bAIA\b|微信|手机号|电话|QQ|二维码|私信|稳赚|无风险|财富自由/i;
  const VIDEO_DISCLAIMER='本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见';
  const XHS_DISCLAIMER='本账号所述内容为个人意见，不代表任何官方意见。';
  const BIO_PREFERRED_MIN=12;
  const BIO_PREFERRED_MAX=20;
  const BIO_ABSOLUTE_MAX=25;
  const BIO_EMOJIS=Object.freeze(['✨','🎓','🏅','🌿','💡','🎯','🧭','📚','🌟','💼','🩺','🚀']);
  function safeXhs(v){return text(v)&&!XHS_BANNED.test(text(v));}
  function emojiLine(emoji,value){const v=text(value);return v?`${emoji} ${v}`:'';}
  function sameMeaning(a,b){
    const normalize=value=>text(value).replace(/二孩|二宝/g,'').replace(/宝妈|妈妈/g,'妈妈').replace(/宝爸|爸爸/g,'爸爸').replace(/\s|，|、|｜/g,'');
    const x=normalize(a),y=normalize(b);return Boolean(x&&y&&(x===y||x.includes(y)||y.includes(x)));
  }
  function bioSemanticFamily(value){
    const v=text(value);
    const groups=[[/财务|会计/,'财务'],[/法务|律师|法律/,'法律'],[/教师|老师|教培/,'教育'],[/健身|教练|运动康复/,'运动'],[/银行/,'银行'],[/工程师|工程/,'工程'],[/医生|护师|护士|医疗/,'医疗'],[/互联网|IT|程序员/,'互联网'],[/地产|房地产/,'地产'],[/销售/,'销售'],[/管理/,'管理']];
    const hit=groups.find(([pattern])=>pattern.test(v));return hit?hit[1]:'';
  }
  function bioFactStrength(value){
    const v=text(value);let score=0;
    if(/\d+(?:\.\d+)?\s*年|\d+\+/.test(v))score+=6;
    if(/职称|资格|证书|MDRT|COT|TOT|会员|讲师|冠军|前十|大使/i.test(v))score+=5;
    if(/经理|总监|负责人|管理者/.test(v))score+=2;
    if(/长期|多年/.test(v)&&!/\d/.test(v))score-=2;
    score+=Math.min(3,Math.floor(v.length/8));
    return score;
  }
  function pushAsset(pool,asset){
    if(!asset?.value)return;
    const family=bioSemanticFamily(asset.value);
    const idx=pool.findIndex(item=>item.type===asset.type&&item.subtype===asset.subtype&&(sameMeaning(item.value,asset.value)||(family&&family===bioSemanticFamily(item.value))));
    if(idx<0){pool.push(asset);return;}
    if(bioFactStrength(asset.value)>bioFactStrength(pool[idx].value))pool[idx]=asset;
  }

  const BIO_GENERIC_DOMAINS=/^(法律|教育|金融|医疗|健康|养老|育儿|科技|互联网|房地产|管理|市场|销售|财务常识|职场|创业经营)$/;
  const BIO_CAREER_SIGNAL=/法务|律师|教师|老师|医生|工程师|HR|人力资源|财务|会计|银行|记者|主持人|程序员|创业者|企业管理|管理者|教练|精算师|工作经验|从业经验|从业经历|工作经历/;
  function normalizeBioCareer(value){
    let v=text(value).replace(/^曾经?从事过?/,'').replace(/^做保险(之前|前)[，,]?/,'').trim();
    if(!v||OMIT.test(v)||BIO_GENERIC_DOMAINS.test(v))return '';
    if(!BIO_CAREER_SIGNAL.test(v))return '';
    v=v.replace(/(工作经验|从业经验|从业经历|工作经历){2,}$/,'工作经验');
    if(/\d+\s*年/.test(v)&&/法务/.test(v)&&!/经验|经历/.test(v))v=`${v}工作经验`;
    else if(/\d+\s*年/.test(v)&&/法律相关工作/.test(v)&&!/经验|经历/.test(v))v=`${v}经验`;
    else if(!/经验|经历/.test(v)&&/法务/.test(v))v=`${v}工作经验`;
    return v;
  }
  function bioCareerFacts(profile){
    const explicit=split(profile?.previousCareer).map(normalizeBioCareer).filter(Boolean);
    const intro=text(profile?.selfIntro);const derived=[];
    const patterns=[
      /(\d+\s*年[^，。；\n]{0,12}(?:企业)?法务(?:工作)?(?:经验|经历)?)/,
      /(\d+\s*年[^，。；\n]{0,12}法律相关工作(?:经验|经历)?)/,
      /(?:曾任|曾做|从事|工作于|任职于)[^，。；\n]{0,16}(法务|律师|教师|老师|医生|工程师|HR|人力资源|财务|会计|银行从业者|记者|主持人|程序员|企业管理者)/
    ];
    patterns.forEach(pattern=>{const m=intro.match(pattern);if(m){const n=normalizeBioCareer(m[1]||m[0]);if(n)derived.push(n);}});
    return uniq([...explicit,...derived]);
  }
  function bioEducationFacts(profile){
    const raw=[profile?.schoolTier,profile?.education,profile?.overseas].map(text).join(' ');const out=[];
    if(/博士/.test(raw))out.push('博士'); else if(/硕士/.test(raw))out.push('硕士'); else if(/本科/.test(raw))out.push('本科'); else if(/大专/.test(raw))out.push('大专');
    if(/QS\s*前?\s*50/i.test(raw))out.push('QS前50'); else if(/QS\s*前?\s*100/i.test(raw))out.push('QS前100');
    if(/985/.test(raw))out.push('985'); if(/211/.test(raw))out.push('211'); if(/留学|海归|海外/.test(raw))out.push('海外学习经历');
    return uniq(out);
  }
  function bioHonorFacts(profile){return uniq(split(profile?.honors).filter(v=>v&&!OMIT.test(v)));}
  function bioInsuranceExperience(profile){
    const raw=text(profile?.insuranceYears);if(!raw)return '';
    if(/^\d+(?:\.\d+)?$/.test(raw))return `${raw}年保险从业经验`;
    if(/^\d+(?:\.\d+)?年多$/.test(raw))return `${raw.replace(/年多$/,'年+')}保险从业经验`;
    if(/^\d+(?:\.\d+)?年\+$/.test(raw)||/^\d+(?:\.\d+)?年$/.test(raw))return `${raw}保险从业经验`;
    if(/多年/.test(raw))return '多年保险行业经验';
    return '保险从业';
  }
  function bioTraitFacts(profile){
    const items=profile?.peerReviewSummary?.topTraits||profile?.peerReviewSummary?.topImpressions||[];
    const controlled=/^(靠谱|真诚|细致|有耐心|理性|务实|有温度|温暖|阳光|行动力强|长期主义)$/;
    return uniq(items.filter(i=>Number(i?.count||1)>=2).map(i=>text(i?.label??i)).filter(v=>controlled.test(v)));
  }
  function bioServiceFacts(profile,platform){
    const evidence=['services','serviceAreas','serviceCapabilities','expertise','specialties'].flatMap(k=>split(profile?.[k])).join('｜');
    if(!evidence)return [];
    const rules=[[/养老|退休/,'养老规划'],[/教育金|子女教育/,'子女教育'],[/财富|资产配置|传承/,'财富规划'],[/家庭保障|家庭保险/,'家庭保障'],[/重疾|医疗|健康保障/,'健康保障'],[/企业主|企业保障|团险/,'企业保障'],[/理赔/,'理赔协助'],[/保单检视|保单整理|保单分析/,'保单检视'],[/保障规划|保险规划|风险保障/,'保障规划']];
    let values=uniq(rules.filter(([p])=>p.test(evidence)).map(([,label])=>label));
    if(platform==='xhs')values=values.filter(safeXhs);
    return values;
  }
  function bioInterestFacts(profile){return uniq([...split(profile?.hobbies),...secondaryTopics(profile).topics]).filter(v=>v&&!OMIT.test(v));}
  function bioAssets(profile,platform='video'){
    const pool=[];const family=familyIdentity(profile);const careers=bioCareerFacts(profile);const education=bioEducationFacts(profile);const insurance=bioInsuranceExperience(profile);const honors=bioHonorFacts(profile);const traits=bioTraitFacts(profile);const services=bioServiceFacts(profile,platform);const interests=bioInterestFacts(profile);
    if(family)pushAsset(pool,{type:'identity',subtype:'family',value:family,score:100,source:'家庭/生活身份'});
    careers.forEach((value,index)=>pushAsset(pool,{type:'identity',subtype:'career',value,score:98-index,source:'明确职业/经历'}));
    education.forEach((value,index)=>pushAsset(pool,{type:'advantage',subtype:'education',value,score:94-index,source:'明确学历'}));
    if(insurance)pushAsset(pool,{type:'advantage',subtype:'insurance',value:insurance,score:92,source:'保险从业年限'});
    honors.forEach((value,index)=>pushAsset(pool,{type:'advantage',subtype:'honor',value,score:90-index,source:'真实荣誉'}));
    traits.forEach((value,index)=>pushAsset(pool,{type:'advantage',subtype:'trait',value,score:82-index,source:'多人客户反馈'}));
    services.forEach((value,index)=>pushAsset(pool,{type:'value',subtype:'service',value,score:88-index,source:'真实服务/内容价值'}));
    interests.forEach((value,index)=>pushAsset(pool,{type:'identity',subtype:'interest',value,score:55-index,source:'真实兴趣'}));
    return pool.sort((a,b)=>b.score-a.score);
  }
  function charWeight(value){
    return [...text(value)].reduce((n,ch)=>{
      if(/\p{Extended_Pictographic}/u.test(ch))return n+2;
      if(/[\u0000-\u007f]/.test(ch))return n+0.6;
      return n+1;
    },0);
  }
  function packBioItems(items,maxLines=3){
    const clean=uniq(items.map(text).filter(Boolean));const lines=[];let current='';
    clean.forEach(item=>{
      const candidate=current?`${current}｜${item}`:item;
      if(current&&charWeight(candidate)>BIO_PREFERRED_MAX){lines.push(current);current=item;}else current=candidate;
    });
    if(current)lines.push(current);
    for(let i=lines.length-1;i>0;i--){
      if(charWeight(lines[i])>=BIO_PREFERRED_MIN)continue;
      const merged=`${lines[i-1]}｜${lines[i]}`;
      if(charWeight(merged)<=BIO_ABSOLUTE_MAX){lines[i-1]=merged;lines.splice(i,1);}
    }
    const packed=lines.flatMap(line=>{
      if(charWeight(line)<=BIO_ABSOLUTE_MAX)return [line];
      const parts=split(line),out=[];let acc='';
      parts.forEach(part=>{const next=acc?`${acc}｜${part}`:part;if(acc&&charWeight(next)>BIO_ABSOLUTE_MAX){out.push(acc);acc=part;}else acc=next;});
      if(acc)out.push(acc);return out;
    });
    // 116：极短资产若没有同维度真实信息可合并，不允许独占一整行。
    return packed.filter(line=>charWeight(line)>=BIO_PREFERRED_MIN).slice(0,maxLines);
  }
  function rebalanceBioLines(lines){
    const out=[...lines];
    for(let i=out.length-1;i>0;i--){
      const a=charWeight(out[i-1]),b=charWeight(out[i]);
      if(b>=BIO_PREFERRED_MIN||a-b<8)continue;
      const parts=split(out[i-1]);
      if(parts.length<2)continue;
      const moved=parts.pop();const left=parts.join('｜');const right=`${moved}｜${out[i]}`;
      if(charWeight(left)>=BIO_PREFERRED_MIN&&charWeight(right)<=BIO_PREFERRED_MAX){out[i-1]=left;out[i]=right;}
    }
    return out;
  }
  function dimensionLines(profile,platform){
    const assets=bioAssets(profile,platform);
    const identityCore=assets.filter(a=>a.type==='identity'&&a.subtype!=='interest').map(a=>a.value);
    const identityInterest=assets.filter(a=>a.type==='identity'&&a.subtype==='interest').map(a=>a.value);
    const advantages=assets.filter(a=>a.type==='advantage').map(a=>a.value);
    const values=assets.filter(a=>a.type==='value').map(a=>a.value);
    let identity=packBioItems(identityCore);
    const interests=packBioItems(identityInterest);
    if(identity.length<3)identity=[...identity,...interests].slice(0,3);
    return {identity:rebalanceBioLines(identity),advantage:rebalanceBioLines(packBioItems(advantages)),value:rebalanceBioLines(packBioItems(values))};
  }
  function dedupeBioLines(lines){
    const out=[];
    lines.map(text).filter(Boolean).forEach(line=>{
      const family=bioSemanticFamily(line);const duplicate=out.findIndex(existing=>sameMeaning(existing,line)||(family&&family===bioSemanticFamily(existing)));
      if(duplicate<0){out.push(line);return;}
      if(bioFactStrength(line)>bioFactStrength(out[duplicate]))out[duplicate]=line;
    });
    return out;
  }
  function bioBody(profile,platform){
    const groups=dimensionLines(profile,platform);const values=[...groups.identity,...groups.advantage,...groups.value];
    let lines=dedupeBioLines(values).map((v,index)=>emojiLine(BIO_EMOJIS[index % BIO_EMOJIS.length],v));
    if(platform==='xhs')lines=lines.filter(line=>safeXhs(line.replace(/^\S+\s+/,'')));
    return lines;
  }
  function explicitLicense(profile){return text(profile?.licenseNumber||profile?.practiceLicense||profile?.licenseNo||profile?.['执业证编号']||profile?.['执业编号']);}
  function complianceFooter(profile,platform){
    if(platform==='xhs') return [XHS_DISCLAIMER];
    const department=text(profile?.department||profile?.marketingServiceDepartment||profile?.['营销服务部']);
    const license=explicitLicense(profile);
    return [VIDEO_DISCLAIMER,`营销服务部：${department||'待补充'}`,`执业证编号：${license||'待补充'}`];
  }
  function buildBios(profile,platform,headlineText){
    const label=platform==='xhs'?'小红书简介 · 推荐版':'视频号 / 抖音简介 · 推荐版';
    const slogan=text(headlineText);const body=bioBody(profile,platform);
    // 117：简介中的总结句也是可见正文行，使用下一枚不重复 Emoji；canonical headline 文本本身保持不变。
    const sloganLine=slogan?emojiLine(BIO_EMOJIS[body.length % BIO_EMOJIS.length],slogan):'';
    return [{label,focus:'我是谁 + 我的优势 + 我能提供什么价值',lines:[...body,...(sloganLine?[sloganLine]:[]),...complianceFooter(profile,platform)]}];
  }

  function enforceProposal(proposal,profile){
    if(!proposal)return proposal;
    const p=profile||{};prepareProfileGoal(p);const branch=secondaryTopics(p);const slogan=headline(p,proposal?.headline);
    proposal.headline=slogan;proposal.subheadline=subheadline(p);proposal.primaryGoal=inferPrimaryGoal(p);
    proposal.clientPortrait=targetPortrait(p);proposal.advantages=advantageItems(p);proposal.tags=proposalTags(p,branch);
    proposal.contentMainline=normalizedMainlines(p,proposal);proposal.secondaryContent=branch.topics;proposal.secondaryContentSource=branch.source;proposal.secondaryContentRanking=branch.ranking;
    proposal.bios=proposal.bios||{};proposal.bios.xiaohongshu=buildBios(p,'xhs',slogan);proposal.bios.videoDouyin=buildBios(p,'video',slogan);
    if(window.aiaNicknamePolicyV1?.enforce)window.aiaNicknamePolicyV1.enforce(proposal,p);
    return proposal;
  }
  function canonicalizeHistory(proposals,profile){return (proposals||[]).map(entry=>{if(entry?.proposal)enforceProposal(entry.proposal,profile||{});return entry;});}
  async function persistCanonical(entry){
    if(!state.matched||!entry?.proposal||!entry?.version||!state.profile?.agentId)return false;
    try{const r=await policyFetch('/api/proposal/canonical',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agentId:state.profile.agentId,version:entry.version,proposal:entry.proposal})});return r.ok;}catch(_){return false;}
  }

  installGoalGate();syncGoalDependentQuestions(state?.profile||{});
  const toneQuestion=Array.isArray(questions)?questions.find(q=>q.key==='contentTone'):null;if(toneQuestion)toneQuestion.multiple=true;
  if(typeof toggleMultiOption==='function'){const base=toggleMultiOption;toggleMultiOption=function ipPolicyToggle(value){const q=questions[state.currentQuestion];if(q?.key==='contentTone'&&!state.multiSelection.has(value)&&state.multiSelection.size>=2)return;return base(value);};}
  if (typeof startWorkspace==='function') {
    const base=startWorkspace;
    startWorkspace=function ipPolicyStartWorkspace(profile,matched,history=[],proposals=[],...rest){
      prepareProfileGoal(profile);installGoalGate();canonicalizeHistory(proposals,profile);
      const result=base(profile,matched,history,proposals,...rest);
      if(!state.requestedTool&&state.activeTool==='script'&&typeof selectTool==='function')selectTool('ip');
      proposals.forEach(entry=>persistCanonical(entry));
      return result;
    };
  }
  if (typeof presentQuestion==='function') { const base=presentQuestion; presentQuestion=function ipPolicyPresentQuestion(...args){installGoalGate();prepareProfileGoal(state.profile||{});return base.apply(this,args);}; }
  if (typeof renderProposal==='function') { const base=renderProposal; renderProposal=function ipPolicyRenderProposal(proposal,version){enforceProposal(proposal,state.profile||{});const result=base.call(this,proposal,version);const entry=state.proposals?.find(x=>Number(x?.version)===Number(version));if(entry)persistCanonical(entry);return result;}; }

  const policyFetch=window.fetch.bind(window);let lastGenerated=null;
  window.fetch=async function ipPolicyFetch(input,init){
    const response=await policyFetch(input,init);const url=typeof input==='string'?input:(input?.url||'');
    if(!/\/api\/generate(?:\?|$)/.test(url)||!response.ok)return response;
    try{
      const payload=await response.clone().json();
      if(payload?.proposal){
        enforceProposal(payload.proposal,state.profile||{});
        lastGenerated={version:payload.version||state.version||1,proposal:payload.proposal,model:payload.model||''};
        if(state.matched&&payload.version)persistCanonical(lastGenerated);
        return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers:{'Content-Type':'application/json'}});
      }
    }catch(_){}
    return response;
  };
  if(typeof generateProposal==='function'){
    const base=generateProposal;
    generateProposal=async function ipPolicyGenerateProposal(...args){
      lastGenerated=null;const result=await base.apply(this,args);
      if(!state.matched&&lastGenerated){
        state.proposals=[lastGenerated];state.version=Number(lastGenerated.version||1)+1;
        if(typeof refreshProposalButton==='function')refreshProposalButton();
        if(typeof updateWorkspaceHeadings==='function')updateWorkspaceHeadings();
        window.aiaScriptRecommendation?.reset?.();
      }else if(state.proposals?.[0]?.proposal){
        enforceProposal(state.proposals[0].proposal,state.profile||{});persistCanonical(state.proposals[0]);window.aiaScriptRecommendation?.reset?.();
      }
      return result;
    };
  }

  window.aiaIpPolicy=Object.freeze({PRIMARY_GOALS,CUSTOMER_MAINLINES,RECRUITMENT_MAINLINES,SECONDARY_ONLY,normalizeGoalValue,inferPrimaryGoal,needsGoalClarification,applyPrimaryGoal,goalQuestion,syncGoalDependentQuestions,normalizedMainlines,secondaryTopics,headline,subheadline,targetPortrait,advantageItems,bioAssets,bioCareerFacts,bioBody,complianceFooter,buildBios,enforceProposal,canonicalizeHistory,persistCanonical,prepareProfileGoal});
})();
