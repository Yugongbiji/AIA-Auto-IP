// 昵称受控生成：唯一 Owner。
// 最新规则：真实高频称呼优先；最终昵称必须且只能包含一个人物称呼主体；
// 六类人物资产可以参与候选，但禁止“成都/TOT/985/有温度 + 称呼”式机械标签拼接。
(function(){
  'use strict';
  const BANNED=/保险|友邦|\bAIA\b|金融|理财|贷款|股票|基金|医疗/i;
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
    if(n.length===2)out.push(n.slice(1));
    if(n.length>=3)out.push(n.slice(-2));
    out.push(n);
    return out;
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
    const goal=t(p.primaryGoal);if(goal==='recruitment')return '成长';
    const secondary=Array.isArray(p.secondaryContent)?t(p.secondaryContent[0]):t(p.secondaryContent);
    const map={'育儿':'育儿','升学教育':'成长','职场成长':'成长','创业经营':'创业','读书':'读书','旅行':'旅行','跑步':'跑步','骑行':'骑行','美食':'生活','摄影':'摄影','户外':'户外','运动健身':'运动'};
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
  function controlledOptions(profile){
    const a=pickAnchor(profile);if(!a)return [];
    const candidates=[];
    const add=(name,angle,reason)=>{name=safeName(name,a);if(name&&!mechanical(name,profile,a)&&!candidates.some(x=>x.name===name))candidates.push({name,angle,reason});};

    const existing=existingNickname(profile,a);
    if(existing)add(existing,'优先保留','已有昵称包含稳定人物称呼且未触发硬性问题，优先保留已有用户记忆');
    add(a,'突出人物','直接使用真实人物称呼，最稳妥，也最不容易因为标签变化而失去识别');

    const job=career(profile);if(job)add(`${job}${a}`,'突出身份','真实职业或长期经历具有辨识度，且与人物称呼组合后仍像自然昵称');
    const family=familyIdentity(profile);if(family)add(`${family}${a}`,'突出身份','真实家庭/生活身份可形成稳定人物记忆，但只在本人资料有明确证据时使用');
    const trait=strongTrait(profile);if(trait)add(`${trait}的${a}`,'突出性格','只使用本人自述或多人客户反馈支持的受控性格词，不凭 AI 感觉贴标签');
    const topic=neutralTopic(profile);if(topic)add(`${a}聊${topic}`,'突出内容','用人物称呼连接已确认的中性内容支线，避免把保险、荣誉或学历直接堆进昵称');
    const city=regionAsset(profile);if(city)add(`${a}在${city}`,'突出地域','真实地域只作为自然语境，不使用“城市+称呼”机械拼接');
    const education=educationAsset(profile);if(education)add(`${a}的${education}视角`,'突出学历','只使用档案明确的学历层级，不反推具体学校；用自然表达替代“985+称呼”式标签拼接');
    const achievement=achievementAsset(profile);if(achievement)add(`${a}的${achievement}手记`,'突出成就','真实成就可以作为候选资产，但必须自然表达，不使用“TOT+称呼”式机械拼接或夸张升级');
    return candidates.slice(0,5);
  }
  function aiFallbackOptions(rawOptions,profile,anchor){
    if(!anchor||!Array.isArray(rawOptions))return [];
    const result=[];
    rawOptions.forEach(item=>{
      const name=safeName(item?.name??item,anchor);
      if(!name||mechanical(name,profile,anchor)||result.some(x=>x.name===name))return;
      result.push({name,angle:t(item?.angle)||'AI 补充',reason:t(item?.reason)||'受控模板不足时的补充候选；仅保留真实人物称呼和已有资料，不新增事实'});
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
  window.aiaNicknamePolicyV1=Object.freeze({controlledOptions,enforce,BANNED,anchors,pickAnchor,aiFallbackOptions});
})();
