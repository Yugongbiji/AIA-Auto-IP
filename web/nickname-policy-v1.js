// 昵称受控生成：唯一 Owner。真实高频称呼优先，任何最终昵称必须且只能包含一个人物称呼主体。
(function(){
  'use strict';
  const BANNED=/保险|友邦|\bAIA\b/i;
  function t(v){return String(v??'').trim();}
  function uniq(a){return [...new Set((a||[]).filter(Boolean))];}
  function missing(v){return /^(无|没有|暂无|未填|未填写|未设置|未提供|不知道|不详|NA|N\/A|null|none)$/i.test(t(v));}
  function peerAnchors(p){return (p.peerReviewSummary?.topNicknames||[]).filter(x=>!missing(x?.label)).sort((a,b)=>Number(b?.count||1)-Number(a?.count||1)).map(x=>t(x.label));}
  function naturalNameAnchors(p){
    const out=[]; const n=t(p.name);
    if(!missing(p.preferredName))out.push(t(p.preferredName));
    if(n){if(n.length===2)out.push(n.slice(1));if(n.length>=3)out.push(n.slice(-2));out.push(n);}
    return out;
  }
  function anchors(p){return uniq([...peerAnchors(p),...naturalNameAnchors(p)]).filter(x=>x&&!BANNED.test(x)&&x.length<=8);}
  function pickAnchor(p){return anchors(p)[0]||'';}
  function career(p){
    const s=t(p.previousCareer);if(!s)return '';
    const allowed=['律师','医生','教师','老师','教练','精算师','HR','会计','财务','记者','主持人','程序员','环保工程师','工程师','创业者'];
    return allowed.find(x=>s.includes(x))||'';
  }
  function familyIdentity(p){const s=[p.selfIntro,p.identity,p.familyIdentity,p.lifeRoles].map(t).join(' ');return ['二宝妈妈','二孩宝妈','宝妈','妈妈','二孩宝爸','宝爸','爸爸'].find(x=>s.includes(x))||'';}
  function strongTrait(p){
    const items=p.peerReviewSummary?.topTraits||p.peerReviewSummary?.topImpressions||[];
    const allowed=['靠谱','真诚','理性','务实','阳光','温暖','有温度'];
    for(const item of items){const label=t(item?.label??item),count=Number(item?.count||1);if(count>=3&&allowed.includes(label))return label;}
    return '';
  }
  function neutralTopic(p){
    const goal=t(p.primaryGoal);if(goal==='recruitment')return '成长';
    const secondary=Array.isArray(p.secondaryContent)?t(p.secondaryContent[0]):t(p.secondaryContent);
    const map={'育儿':'育儿','升学教育':'成长','职场成长':'成长','创业经营':'创业','读书':'读书','旅行':'旅行','跑步':'跑步','骑行':'骑行','美食':'生活'};
    return map[secondary]||'';
  }
  function existingNicknameAnchor(p,a){
    const values=[p.videoNickname,p.xiaohongshuNickname].map(t).filter(v=>v&&!missing(v)&&!BANNED.test(v));
    return values.find(v=>a&&v.includes(a)&&v.split(a).length-1===1)||'';
  }
  function safeName(name,anchor){const n=t(name).replace(/\s+/g,'');if(!n||BANNED.test(n)||!anchor||!n.includes(anchor))return '';if(n.split(anchor).length-1!==1)return '';return n.slice(0,18);}
  function controlledOptions(profile){
    const a=pickAnchor(profile);if(!a)return [];
    const candidates=[];const add=(name,angle,reason)=>{name=safeName(name,a);if(name&&!candidates.some(x=>x.name===name))candidates.push({name,angle,reason});};
    const existing=existingNicknameAnchor(profile,a);if(existing)add(existing,'优先保留','已有昵称自然、有人物主体且未触发硬性禁用词，优先保留稳定识别');
    add(a,'突出人物','直接强化真实人物称呼，最稳妥、最适合长期使用');
    const job=career(profile);if(job)add(`${job}${a}`,'突出身份','真实职业本身具有识别度，且组合后仍像正常昵称');
    const family=familyIdentity(profile);if(family)add(`${family}${a}`,'突出身份','真实生活身份与人物称呼组合，形成清晰记忆点');
    const trait=strongTrait(profile);if(trait)add(`${trait}的${a}`,'突出性格','仅多人客户反馈反复出现、且适合公开表达的特点才考虑使用');
    const topic=neutralTopic(profile);if(topic)add(`${a}聊${topic}`,'突出内容','用真实人物称呼连接已确认的中性内容方向，不堆保险、荣誉或学历标签');
    return candidates.slice(0,5);
  }
  function enforce(proposal,profile){
    if(!proposal)return proposal;
    const controlled=controlledOptions(profile||{});
    proposal.nicknameOptions=controlled;
    proposal.nicknameNeedsIdentity=!controlled.length;
    return proposal;
  }
  if(typeof renderProposal==='function'){const base=renderProposal;renderProposal=function(proposal,version){enforce(proposal,state.profile||{});return base(proposal,version);};}
  window.aiaNicknamePolicyV1=Object.freeze({controlledOptions,enforce,BANNED,anchors,pickAnchor});
})();
