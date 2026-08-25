// 昵称受控生成：唯一 Owner。
// 最新规则：客户/身边人真实高频称呼优先；最终昵称必须且只能包含一个人物称呼主体；
// 禁止随意截取姓名单字造昵称；六类人物资产只用于启发，不机械拼接；候选必须通过中文口语自然度检查。
(function(){
  'use strict';
  const BANNED=/保险|友邦|\bAIA\b|金融|理财|贷款|股票|基金|医疗/i;
  const GENERIC_SUFFIXES=['的小世界','小世界','的日常','聊生活','看世界'];
  function t(v){return String(v??'').trim();}
  function uniq(a){return [...new Set((a||[]).filter(Boolean))];}
  function missing(v){return /^(无|没有|暂无|未填|未填写|未设置|未提供|不知道|不详|NA|N\/A|null|none)$/i.test(t(v));}
  function peerAnchors(p){return (p.peerReviewSummary?.topNicknames||[]).filter(x=>!missing(x?.label)).sort((a,b)=>Number(b?.count||1)-Number(a?.count||1)).map(x=>t(x.label));}
  function preferredAnchors(p){const value=t(p.preferredName);return value&&!missing(value)?[value]:[];}
  function existingPersonAnchors(p){
    const values=[p.videoNickname,p.xiaohongshuNickname].map(t).filter(v=>v&&!missing(v)&&!BANNED.test(v));
    const out=[];
    values.forEach(value=>{
      const matches=value.match(/(?:小[\u4e00-\u9fa5]{1,2}|阿[\u4e00-\u9fa5]{1,2}|[\u4e00-\u9fa5]{1,3}(?:姐|哥|老师|妈妈|妈|爸爸|爸|总)|[A-Za-z]{2,10}(?:姐|哥)?)/g)||[];
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
  function anchors(p){return uniq([...peerAnchors(p),...preferredAnchors(p),...existingPersonAnchors(p),...naturalNameAnchors(p)]).filter(x=>x&&!BANNED.test(x)&&x.length<=10);}
  function pickAnchor(p){return anchors(p)[0]||'';}
  function career(p){
    const s=t(p.previousCareer)||t(p.selfIntro);if(!s)return '';
    const allowed=['律师','医生','教师','老师','教练','精算师','HR','会计','财务','记者','主持人','程序员','环保工程师','工程师','创业者','企业主','银行从业者'];
    return allowed.find(x=>s.includes(x))||'';
  }
  function familyIdentity(p){const s=[p.selfIntro,p.identity,p.familyIdentity,p.lifeRoles].map(t).join(' ');return ['二宝妈妈','二孩宝妈','二孩妈妈','宝妈','妈妈','二孩宝爸','二孩爸爸','宝爸','爸爸'].find(x=>s.includes(x))||'';}
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
    // #107：不再用“生活/成长”等万能尾缀批量生产同质昵称，只保留有明确内容辨识度的方向。
    const map={'育儿':'育儿','创业经营':'创业','读书':'读书','旅行':'旅行','跑步':'跑步','骑行':'骑行','摄影':'摄影','户外':'户外','运动健身':'运动'};
    return map[secondary]||'';
  }
  function existingNickname(profile,anchor){
    const values=[profile.videoNickname,profile.xiaohongshuNickname].map(t).filter(v=>v&&!missing(v)&&!BANNED.test(v));
    return values.find(v=>anchor&&v.includes(anchor)&&v.split(anchor).length-1===1)||'';
  }
  function safeName(name,anchor){
    const n=t(name).replace(/\s+/g,'');
    if(!n||BANNED.test(n)||!anchor||!n.includes(anchor))return '';
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
    // #106：同一人物主体不能用“全名 + 真实称呼”重复表达，如“王一的一一世界”。
    const full=t(profile.name).replace(/\s+/g,'');
    if(full&&anchor&&full!==anchor&&n.includes(full)&&n.includes(anchor))return true;
    // 动作句更像标题而不是昵称，例如“yana打网球”。
    if(new RegExp(`^${anchor}(打|跑|去|做|学|玩|吃|喝|逛)`).test(n))return true;
    // #107：已有昵称可保留成熟表达；新生成候选不批量使用万能模板。
    if(!existing&&GENERIC_SUFFIXES.some(s=>n===`${anchor}${s}`))return true;
    return false;
  }
  function controlledOptions(profile){
    const a=pickAnchor(profile);if(!a)return [];
    const candidates=[];
    const add=(name,angle,reason,opts={})=>{name=safeName(name,a);if(name&&!mechanical(name,profile,a)&&!awkward(name,profile,a,opts)&&!candidates.some(x=>x.name===name))candidates.push({name,angle,reason});};

    const existing=existingNickname(profile,a);
    if(existing)add(existing,'优先保留','已有昵称自然、合规且包含稳定人物称呼时，优先保护已有用户记忆',{existing:true});
    add(a,'突出人物','优先使用客户/身边人真实称呼；没有真实称呼时再使用本人明确称呼或本名兜底');

    const job=career(profile);if(job)add(`${job}${a}`,'突出身份','真实职业或长期经历有辨识度，且组合后仍需像自然昵称而不是简历标签');
    const family=familyIdentity(profile);if(family)add(`${family}${a}`,'突出身份','真实家庭/生活身份可形成稳定人物记忆，只在本人资料有明确证据时使用');
    const trait=strongTrait(profile);if(trait)add(`${trait}的${a}`,'突出性格','客户反馈只用于理解人物认知；仅在表达自然且确有多人证据时作为候选，不机械套“形容词+名字”');
    const topic=neutralTopic(profile);if(topic)add(`${a}聊${topic}`,'突出内容','只连接已确认且有辨识度的中性内容方向，不使用“聊生活/聊成长”等万能尾缀');
    const city=regionAsset(profile);if(city)add(`${a}在${city}`,'突出地域','真实地域只作为自然语境，不使用“城市+称呼”机械拼接');
    const education=educationAsset(profile);if(education)add(`${a}的${education}视角`,'突出学历','只使用档案明确的学历层级；生成后仍需通过自然度检查');
    const achievement=achievementAsset(profile);if(achievement)add(`${a}的${achievement}手记`,'突出成就','真实成就只作为灵感资产，不强制进入昵称，不使用“TOT+称呼”式机械拼接');
    return candidates.slice(0,5);
  }
  function aiFallbackOptions(rawOptions,profile,anchor){
    if(!anchor||!Array.isArray(rawOptions))return [];
    const result=[];
    rawOptions.forEach(item=>{
      const name=safeName(item?.name??item,anchor);
      if(!name||mechanical(name,profile,anchor)||awkward(name,profile,anchor)||result.some(x=>x.name===name))return;
      result.push({name,angle:t(item?.angle)||'AI 补充',reason:t(item?.reason)||'受控候选不足时的补充；必须基于真实称呼和真实资料，并通过中文自然度检查'});
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
    proposal.nicknameOptions=controlled.slice(0,5);
    proposal.nicknameNeedsIdentity=!a;
    return proposal;
  }
  if(typeof renderProposal==='function'){const base=renderProposal;renderProposal=function(proposal,version){enforce(proposal,state.profile||{});return base(proposal,version);};}
  window.aiaNicknamePolicyV1=Object.freeze({controlledOptions,enforce,BANNED,anchors,pickAnchor,aiFallbackOptions,naturalNameAnchors,awkward});
})();
