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
  function safeXhs(v){return text(v)&&!XHS_BANNED.test(text(v));}
  function emojiLine(emoji,value){const v=text(value);return v?`${emoji} ${v}`:'';}
  function sameMeaning(a,b){
    const normalize=value=>text(value).replace(/二孩|二宝/g,'').replace(/宝妈|妈妈/g,'妈妈').replace(/宝爸|爸爸/g,'爸爸').replace(/\s|，|、|｜/g,'');
    const x=normalize(a),y=normalize(b);return Boolean(x&&y&&(x===y||x.includes(y)||y.includes(x)));
  }
  function pushAsset(pool,asset){
    if(!asset?.value)return;
    if(pool.some(item=>item.type===asset.type&&sameMeaning(item.value,asset.value)))return;
    pool.push(asset);
  }
  function bioAssets(profile){
    const pool=[];const job=career(profile),family=familyIdentity(profile),city=text(profile?.city),ps=proofs(profile),traits=feedback(profile),services=serviceLabels(profile);
    if(job)pushAsset(pool,{type:'career',value:job,score:100,source:'真实职业/经历'});
    if(family)pushAsset(pool,{type:'family',value:family,score:95,source:'家庭/生活身份'});
    ps.forEach((value,index)=>pushAsset(pool,{type:'proof',value,score:90-index*4,source:'学历/年限/荣誉'}));
    if(services.length)pushAsset(pool,{type:'service',value:services.slice(0,4).join('｜'),items:services.slice(0,4),score:84,source:'真实服务'});
    traits.forEach((value,index)=>pushAsset(pool,{type:'feedback',value,score:74-index*3,source:'多人客户反馈'}));
    if(city&&!OMIT.test(city))pushAsset(pool,{type:'region',value:city,score:58,source:'所在城市'});
    const interests=uniq([...split(profile?.hobbies),...secondaryTopics(profile).topics]).filter(v=>SECONDARY_ONLY.includes(v)||v.length<=10).slice(0,2);
    if(interests.length)pushAsset(pool,{type:'interest',value:interests.join('、'),items:interests,score:50,source:'真实兴趣/内容支线'});
    return pool.sort((a,b)=>b.score-a.score);
  }
  function identitySentence(profile){
    const family=familyIdentity(profile),job=career(profile);
    if(family&&job&&!sameMeaning(family,job))return `${family}，曾从事${job}`;
    return family || (job?`曾从事${job}`:'');
  }
  function proofSentence(assets){
    const values=assets.filter(a=>a.type==='proof').slice(0,2).map(a=>a.value);
    return values.length?`专业经历里，比较有代表性的是${values.join('、')}`:'';
  }
  function feedbackSentence(assets){const values=assets.filter(a=>a.type==='feedback').slice(0,2).map(a=>a.value);return values.length?`客户比较常提到我${values.join('、')}`:'';}
  function serviceSentence(assets){const asset=assets.find(a=>a.type==='service');return asset?.items?.length?asset.items.join('｜'):'';}
  function interestSentence(assets){const asset=assets.find(a=>a.type==='interest');return asset?.items?.length?`生活里也会分享${asset.items.slice(0,2).join('、')}`:'';}
  function regionSentence(assets){const asset=assets.find(a=>a.type==='region');return asset?`在${asset.value}生活和工作`:'';}
  function mainBioLine(profile,platform){
    const recruitment=inferPrimaryGoal(profile)===PRIMARY_GOALS.RECRUITMENT;
    if(recruitment)return platform==='xhs'?'分享职业选择、成长与长期主义相关内容':'分享职业选择、转型成长与团队真实经验';
    return platform==='xhs'?'分享家庭保障、养老准备与长期规划相关内容':'分享保险、家庭保障、养老与长期规划相关内容';
  }
  function dedupeBioLines(lines){
    const out=[];
    lines.map(text).filter(Boolean).forEach(line=>{if(!out.some(existing=>sameMeaning(existing,line)))out.push(line);});
    return out;
  }
  function bioBody(profile,platform,variant){
    const assets=bioAssets(profile),identity=identitySentence(profile),main=mainBioLine(profile,platform),proof=proofSentence(assets),feedbackText=feedbackSentence(assets),service=serviceSentence(assets),interest=interestSentence(assets),region=regionSentence(assets);
    let raw=[];
    if(variant==='memory'){
      raw=[emojiLine('👤',identity||region),feedbackText?emojiLine('✨',feedbackText):'',emojiLine('💬',main),interest?emojiLine('🌿',interest):'',proof?emojiLine('🏅',proof):''];
    }else if(variant==='service'){
      raw=[emojiLine('👤',identity||region),emojiLine('💬',main),service?emojiLine('🧭',service):'',proof?emojiLine('🏅',proof):'',feedbackText?emojiLine('✨',feedbackText):''];
    }else{
      raw=[emojiLine('👤',identity||region),proof?emojiLine('🏅',proof):'',emojiLine('💬',main),service?emojiLine('🧭',service):'',feedbackText?emojiLine('✨',feedbackText):''];
    }
    let lines=dedupeBioLines(raw);
    // 地域和兴趣是次级资产，只在更强资产不足或记忆型策略中补充，不为“丰富”机械凑行。
    if(lines.length<4&&region&&!(identity||'').includes(region))lines.push(emojiLine('📍',region));
    if(lines.length<4&&interest&&variant!=='service')lines.push(emojiLine('🌿',interest));
    lines=dedupeBioLines(lines).slice(0,5);
    if(platform==='xhs')lines=lines.filter(safeXhs);
    // 平台过滤后也必须保留主价值表达；如小红书敏感词过滤掉某行，使用合规的价值表达补位。
    if(platform==='xhs'&&!lines.some(line=>/分享|记录|聊/.test(line))){const safeMain='💬 分享家庭成长、养老准备与长期规划中的实用经验';if(safeXhs(safeMain))lines.push(safeMain);}
    return dedupeBioLines(lines).slice(0,5);
  }
  function explicitLicense(profile){return text(profile?.licenseNumber||profile?.practiceLicense||profile?.licenseNo||profile?.['执业证编号']||profile?.['执业编号']);}
  function complianceFooter(profile,platform){
    if(platform==='xhs') return [XHS_DISCLAIMER];
    const out=[VIDEO_DISCLAIMER];
    const department=text(profile?.department); out.push(`营销服务部：${department||'待补充'}`);
    const license=explicitLicense(profile); out.push(`执业证编号：${license||'000'}`);
    return out;
  }
  function buildBios(profile,platform){
    const defs=[['方案 A · 专业背书','proof'],['方案 B · 人设记忆','memory'],['方案 C · 价值服务','service']];
    return defs.map(([label,variant])=>({label,focus:variant==='proof'?'我是谁 + 为什么值得相信':variant==='memory'?'让别人先记住这个人':'我能给你带来什么',lines:[...bioBody(profile,platform,variant),...complianceFooter(profile,platform)]}));
  }

  function enforceProposal(proposal,profile){
    if(!proposal)return proposal;
    const p=profile||{};prepareProfileGoal(p);const branch=secondaryTopics(p);
    proposal.headline=headline(p);proposal.subheadline=subheadline(p);proposal.primaryGoal=inferPrimaryGoal(p);
    proposal.clientPortrait=targetPortrait(p);proposal.advantages=advantageItems(p);proposal.tags=proposalTags(p,branch);
    proposal.contentMainline=normalizedMainlines(p,proposal);proposal.secondaryContent=branch.topics;proposal.secondaryContentSource=branch.source;proposal.secondaryContentRanking=branch.ranking;
    proposal.bios=proposal.bios||{};proposal.bios.xiaohongshu=buildBios(p,'xhs');proposal.bios.videoDouyin=buildBios(p,'video');
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
      // 独立“内容规划”已退役，历史 contentPlans 不得再决定默认落到脚本改写。
      if(!state.requestedTool&&state.activeTool==='script'&&typeof selectTool==='function')selectTool('ip');
      proposals.forEach(entry=>persistCanonical(entry));
      return result;
    };
  }
  if (typeof presentQuestion==='function') { const base=presentQuestion; presentQuestion=function ipPolicyPresentQuestion(...args){installGoalGate();prepareProfileGoal(state.profile||{});return base.apply(this,args);}; }
  if (typeof renderProposal==='function') { const base=renderProposal; renderProposal=function ipPolicyRenderProposal(proposal,version){enforceProposal(proposal,state.profile||{});const result=base.call(this,proposal,version);const entry=state.proposals?.find(x=>Number(x?.version)===Number(version));if(entry)persistCanonical(entry);return result;}; }

  // Canonicalize /api/generate before app.js stores or downstream modules read it.
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

  window.aiaIpPolicy=Object.freeze({PRIMARY_GOALS,CUSTOMER_MAINLINES,RECRUITMENT_MAINLINES,SECONDARY_ONLY,normalizeGoalValue,inferPrimaryGoal,needsGoalClarification,applyPrimaryGoal,goalQuestion,syncGoalDependentQuestions,normalizedMainlines,secondaryTopics,headline,subheadline,targetPortrait,advantageItems,bioAssets,bioBody,complianceFooter,buildBios,enforceProposal,canonicalizeHistory,persistCanonical,prepareProfileGoal});
})();
