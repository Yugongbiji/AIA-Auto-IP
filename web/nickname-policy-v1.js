// 昵称受控生成：唯一 Owner。
// 最新规则：客户/身边人真实高频称呼优先；最终昵称必须且只能包含一个人物称呼主体；
// 禁止随意截取姓名单字造昵称；过往职业只进入简介、不进入推荐昵称；候选必须通过中文口语自然度检查。
// #111：已有特色原昵称优先；否则优先“人物锚点 + 当前仍成立的鲜明兴趣/特点”，单独本名/称呼仅作稳妥备选。
// #112：有明确证据且自然的记忆点修饰语可排在裸称呼前；#113：中文可记忆/可搜索优先，降级全英文并过滤特殊符号/Emoji。
// #114：真实称呼是人物锚点，不是默认首选；候选必须按陌生人记忆点做确定性评分，只要有高分特色候选，裸姓名/裸称呼不得排第一。
(function(){
  'use strict';
  const BANNED=/保险|友邦|\bAIA\b|金融|理财|贷款|股票|基金|医疗/i;
  const GENERIC_SUFFIXES=['的小世界','小世界','的日常','聊生活','看世界'];
  function t(v){return String(v??'').trim();}
  function uniq(a){return [...new Set((a||[]).filter(Boolean))];}
  function missing(v){return /^(无|没有|暂无|未填|未填写|未设置|未提供|不知道|不详|0|NA|N\/A|null|none)$/i.test(t(v));}
  function peerAnchors(p){return (p.peerReviewSummary?.topNicknames||[]).filter(x=>!missing(x?.label)).sort((a,b)=>Number(b?.count||1)-Number(a?.count||1)).map(x=>t(x.label));}
  function preferredAnchors(p){const value=t(p.preferredName);return value&&!missing(value)?[value]:[];}
  function existingPersonAnchors(p){
    const values=[p.videoNickname,p.xiaohongshuNickname].map(t).filter(v=>v&&!missing(v)&&!BANNED.test(v));
    const out=[];
    values.forEach(value=>{
      const matches=value.match(/(?:小[\u4e00-\u9fa5]{1,2}|阿[\u4e00-\u9fa5]{1,2}|[\u4e00-\u9fa5]{1,3}(?:姐|哥|老师|妈妈|妈|爸爸|爸|总)|[A-Za-z]{2,12}(?:姐|哥)?)/g)||[];
      matches.forEach(match=>out.push(match));
    });
    return uniq(out);
  }
  function naturalNameAnchors(p){
    const out=[];const n=t(p.name);if(!n)return out;
    // #104：禁止“张三 → 三”“王一 → 一”这类单字截取。没有真实称呼证据时，二字姓名只使用全名兜底。
    if(n.length>=3)out.push(n.slice(-2));
    out.push(n);
    return uniq(out).filter(x=>x.length>=2);
  }
  function anchors(p){return uniq([...peerAnchors(p),...preferredAnchors(p),...existingPersonAnchors(p),...naturalNameAnchors(p)]).filter(x=>x&&!BANNED.test(x)&&x.length<=12);}
  function pickAnchor(p){return anchors(p)[0]||'';}
  function familyIdentity(p){const s=[p.selfIntro,p.identity,p.familyIdentity,p.lifeRoles].map(t).join(' ');return ['四娃爸爸','四个儿子的父亲','二宝妈妈','二孩宝妈','二孩妈妈','宝妈','妈妈','二孩宝爸','二孩爸爸','宝爸','爸爸'].find(x=>s.includes(x))||'';}
  function strongTrait(p){
    const allowed=['靠谱','真诚','细致','有耐心','理性','务实','有温度','温暖','阳光','行动力强','长期主义'];
    const items=p.peerReviewSummary?.topTraits||p.peerReviewSummary?.topImpressions||[];
    for(const item of items){const label=t(item?.label??item),count=Number(item?.count||1);if(count>=2&&allowed.includes(label))return label;}
    const own=[p.strengths,p.selfIntro].map(t).join(' ');return allowed.find(x=>own.includes(x))||'';
  }
  function educationAsset(p){
    const s=[p.education,p.schoolTier,p.overseas].map(t).join(' ');
    if(/博士/.test(s))return '博士';
    if(/硕士/.test(s))return '硕士';
    if(/QS\s*前?\s*50/i.test(s))return 'QS前50';
    if(/QS\s*前?\s*100/i.test(s))return 'QS前100';
    if(/985/.test(s))return '985';
    if(/211/.test(s))return '211';
    if(/留学|海归|海外/.test(s))return '海归';
    return '';
  }
  function achievementAsset(p){
    const honors=t(p.honors);return ['TOT','COT','MDRT','五星会员','销冠','冠军'].find(x=>new RegExp(x,'i').test(honors))||'';
  }
  function regionAsset(p){const city=t(p.city);return city&&!missing(city)&&city.length<=8?city:'';}
  function neutralTopic(p){
    const secondary=Array.isArray(p.secondaryContent)?t(p.secondaryContent[0]):t(p.secondaryContent);
    const map={'育儿':'育儿','创业经营':'创业','读书':'读书','旅行':'旅行','跑步':'跑步','骑行':'骑行','摄影':'摄影','户外':'户外','运动健身':'运动'};
    return map[secondary]||'';
  }
  function memorablePeerDescriptor(p){
    // #112：只复用反馈/本人资料里真实出现、明显增加辨识度的短表达；不把普通“靠谱/专业”机械前缀化。
    const quotes=(p.peerReviewSummary?.representativeQuotes||[]).map(t).join(' ');
    const own=[p.selfIntro,p.strengths].map(t).join(' ');
    const text=`${quotes} ${own}`;
    return ['有料有趣','爱笑','拼命姑娘','人间清醒','有梗','目标清晰','学霸','情绪稳定'].find(x=>text.includes(x))||'';
  }
  function descriptorOptions(profile,anchor){
    const d=memorablePeerDescriptor(profile);if(!d)return [];
    return [{name:`${d}的${anchor}`,angle:'突出记忆点',reason:'客户/身边人反馈或本人资料中已自然出现该鲜明表达，组合后比裸称呼更有记忆点',memoryKind:'descriptor'}];
  }
  function distinctiveOptions(profile,anchor){
    // #111/#114：只取当前仍成立、由本人资料明确支持的兴趣/生活/内容特点；绝不读取过往职业来制造昵称。
    const s=[profile.selfIntro,profile.interests,profile.hobbies,profile.lifeRoles,Array.isArray(profile.secondaryContent)?profile.secondaryContent.join(' '):profile.secondaryContent].map(t).join(' ');
    const out=[];
    const add=(name,reason)=>{if(name&&!out.some(x=>x.name===name))out.push({name,angle:'突出记忆点',reason,memoryKind:'distinctive'});};
    if(/八块腹肌/.test(s)){add(`八块腹肌${anchor}`,'本人资料明确的持续健身特点具有强记忆点，比单独本名更有辨识度');add(`${anchor}练起来`,'本人长期健身且有训练内容时，可用更有网感的自然表达');}
    if(/手帐/.test(s))add(`手帐控${anchor}`,'本人长期手帐兴趣/内容资产可形成稳定记忆点');
    if(/纪录片/.test(s))add(`纪录片迷${anchor}`,'本人长期纪录片兴趣可形成鲜明且可持续的内容记忆点');
    if(/攀岩/.test(s))add(`爱攀岩的${anchor}`,'本人持续攀岩兴趣可形成鲜明生活记忆点');
    if(/滑雪/.test(s))add(`爱滑雪的${anchor}`,'本人持续滑雪兴趣可形成鲜明生活记忆点');
    if(/网球/.test(s))add(`网球搭子${anchor}`,'本人持续网球兴趣可形成自然、有网感的生活记忆点');
    if(/羽毛球/.test(s))add(`羽球搭子${anchor}`,'本人持续羽毛球兴趣可形成自然、有网感的生活记忆点');
    if(/足球|踢球/.test(s))add(`足球迷${anchor}`,'本人持续足球兴趣可形成稳定记忆点');
    if(/读书|阅读/.test(s))add(`爱读书的${anchor}`,'本人持续阅读兴趣可形成稳定生活记忆点');
    if(/插花/.test(s))add(`爱插花的${anchor}`,'本人持续插花兴趣可形成鲜明生活记忆点');
    if(/咖啡/.test(s))add(`咖啡${anchor}`,'本人明确喜欢咖啡时，可形成短而易记的生活型昵称');
    if(/钓鱼/.test(s))add(`钓鱼${anchor}`,'本人持续钓鱼兴趣具有鲜明生活记忆点');
    return out.slice(0,3);
  }
  function normalizeSearchable(name){
    // #113：推荐版本去除空格、特殊符号、Emoji、装饰标点；保留中文、英文和数字本身。
    return t(name).replace(/\s+/g,'').replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g,'');
  }
  function fullEnglish(name){const n=normalizeSearchable(name);return !!n&&/[A-Za-z]/.test(n)&&!/\u4e00-\u9fa5/.test('')&&/^[A-Za-z0-9]+$/.test(n)&&!/[^A-Za-z0-9]/.test(n)&&!/^[0-9]+$/.test(n)&&!/[\u4e00-\u9fa5]/.test(n);}
  function hasChinese(name){return /[\u4e00-\u9fa5]/.test(t(name));}
  function existingNickname(profile,anchor){
    const values=[profile.videoNickname,profile.xiaohongshuNickname].map(t).filter(v=>v&&!missing(v)&&!BANNED.test(v));
    for(const raw of values){
      const value=normalizeSearchable(raw);
      if(!value||fullEnglish(value)||!hasChinese(value))continue;
      if(anchor&&value.includes(anchor)&&value.split(anchor).length-1===1)return value;
    }
    return '';
  }
  function safeName(name,anchor){
    const n=normalizeSearchable(name);
    if(!n||BANNED.test(n)||!anchor||!n.includes(anchor))return '';
    // #113：全英文不进入系统推荐；中英混合允许，但必须有中文承担记忆/搜索语义。
    if(fullEnglish(n)||!hasChinese(n))return '';
    if(n.split(anchor).length-1!==1||n.length>18)return '';
    return n;
  }
  function mechanical(name,profile,anchor){
    const n=t(name).replace(/\s+/g,'');
    const assets=[regionAsset(profile),educationAsset(profile),achievementAsset(profile),strongTrait(profile)].filter(Boolean);
    return assets.some(asset=>n===`${asset}${anchor}`||n===`${anchor}${asset}`);
  }
  function awkward(name,profile,anchor,{existing=false}={}){
    const n=t(name).replace(/\s+/g,'');
    if(!n)return true;
    const full=t(profile.name).replace(/\s+/g,'');
    if(full&&anchor&&full!==anchor&&n.includes(full)&&n.includes(anchor))return true;
    if(new RegExp(`^${anchor}(打|跑|去|做|学|玩|吃|喝|逛)`).test(n))return true;
    if(!existing&&GENERIC_SUFFIXES.some(s=>n===`${anchor}${s}`))return true;
    return false;
  }
  function memoryScore(item,profile,anchor,existing){
    // #114 Nickname Memory Score：真实称呼负责锚定人物，首选排序由陌生人记忆点决定。
    let score=0;
    const name=t(item?.name),kind=t(item?.memoryKind);
    if(existing&&name===existing)score+=3;
    if(kind==='distinctive')score+=3;
    if(kind==='descriptor')score+=2;
    const peer=(profile.peerReviewSummary?.topNicknames||[]).some(x=>t(x?.label)===anchor&&Number(x?.count||1)>=2);
    if(peer&&name.includes(anchor))score+=2;
    if(name===anchor||name===t(profile.name))score+=0;
    if(/\d{3,}$/.test(name))score-=2;
    if(fullEnglish(name))score-=3;
    if(GENERIC_SUFFIXES.some(s=>name.endsWith(s)))score-=5;
    return score;
  }
  function rankByMemory(candidates,profile,anchor,existing){
    return candidates.map((item,index)=>({...item,memoryScore:memoryScore(item,profile,anchor,existing),_order:index})).sort((a,b)=>b.memoryScore-a.memoryScore||a._order-b._order).map(({_order,...item})=>item);
  }
  function controlledOptions(profile){
    const a=pickAnchor(profile);if(!a)return [];
    const candidates=[];
    const add=(name,angle,reason,opts={})=>{name=safeName(name,a);if(name&&!mechanical(name,profile,a)&&!awkward(name,profile,a,opts)&&!candidates.some(x=>x.name===name))candidates.push({name,angle,reason,memoryKind:t(opts.memoryKind)});};

    const existing=existingNickname(profile,a);
    if(existing)add(existing,'优先保留','已有昵称自然、合规、有特色、便于中文记忆搜索且包含稳定人物称呼时，优先保护已有用户记忆',{existing:true,memoryKind:'existing'});
    descriptorOptions(profile,a).forEach(item=>add(item.name,item.angle,item.reason,{memoryKind:item.memoryKind}));
    distinctiveOptions(profile,a).forEach(item=>add(item.name,item.angle,item.reason,{memoryKind:item.memoryKind}));
    add(a,'突出人物','优先使用客户/身边人真实称呼作为人物锚点；纯称呼/本名只作稳妥备选，存在真实记忆点时不得默认首选',{memoryKind:'plain'});

    // #108：过往职业只用于简介/IP 定位，不再作为推荐昵称路线，避免把历史职业误写成当前身份。
    const family=familyIdentity(profile);if(family)add(`${family}${a}`,'突出身份','真实且当前持续存在的家庭/生活身份可形成稳定人物记忆，只在本人资料有明确证据时使用',{memoryKind:'distinctive'});
    const trait=strongTrait(profile);if(trait)add(`${trait}的${a}`,'突出性格','客户反馈只用于理解人物认知；仅在表达自然且确有多人证据时作为候选，不机械套“形容词+名字”',{memoryKind:'plain'});
    const topic=neutralTopic(profile);if(topic)add(`${a}聊${topic}`,'突出内容','只连接已确认且有辨识度的中性内容方向，不使用“聊生活/聊成长”等万能尾缀',{memoryKind:'distinctive'});
    const city=regionAsset(profile);if(city)add(`${a}在${city}`,'突出地域','真实地域只作为自然语境，不使用“城市+称呼”机械拼接');
    const education=educationAsset(profile);if(education)add(`${a}的${education}视角`,'突出学历','只使用档案明确的学历层级；生成后仍需通过自然度检查');
    const achievement=achievementAsset(profile);if(achievement)add(`${a}的${achievement}手记`,'突出成就','真实成就只作为灵感资产，不强制进入昵称，不使用“TOT+称呼”式机械拼接');
    // #109：这里只生成一个核心人物称呼型候选；已有好昵称最多再占一个名额。其余路线必须提供新增信息，不能轮流罗列多个称呼。
    // #114：最终再做确定性记忆点评分；有真实特色候选时，裸姓名/裸称呼不会因为“最安全”自动排第一。
    return rankByMemory(candidates,profile,a,existing).slice(0,5);
  }
  function aiFallbackOptions(rawOptions,profile,anchor){
    if(!anchor||!Array.isArray(rawOptions))return [];
    const result=[];
    rawOptions.forEach(item=>{
      const name=safeName(item?.name??item,anchor);
      if(!name||mechanical(name,profile,anchor)||awkward(name,profile,anchor)||result.some(x=>x.name===name))return;
      result.push({name,angle:t(item?.angle)||'AI 补充',reason:t(item?.reason)||'受控候选不足时的补充；必须基于真实称呼和真实资料，并通过中文自然度、可记忆与可搜索检查',memoryKind:'ai'});
    });
    return result;
  }
  function enforce(proposal,profile){
    if(!proposal)return proposal;
    const p=profile||{},raw=Array.isArray(proposal.nicknameOptions)?proposal.nicknameOptions:[];
    const a=pickAnchor(p),controlled=controlledOptions(p);
    if(a&&controlled.length<3){
      aiFallbackOptions(raw,p,a).forEach(item=>{if(controlled.length<5&&!controlled.some(x=>x.name===item.name))controlled.push(item);});
    }
    const existing=existingNickname(p,a);
    proposal.nicknameOptions=rankByMemory(controlled,p,a,existing).slice(0,5);
    proposal.nicknameNeedsIdentity=!a;
    return proposal;
  }
  if(typeof renderProposal==='function'){const base=renderProposal;renderProposal=function(proposal,version){enforce(proposal,state.profile||{});return base(proposal,version);};}
  window.aiaNicknamePolicyV1=Object.freeze({controlledOptions,enforce,BANNED,anchors,pickAnchor,aiFallbackOptions,naturalNameAnchors,awkward,distinctiveOptions,memorablePeerDescriptor,descriptorOptions,normalizeSearchable,fullEnglish,memoryScore,rankByMemory});
})();