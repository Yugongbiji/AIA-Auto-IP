// 昵称受控生成 V1：真实证据 -> 人物称呼 -> 六类模板 -> 合规过滤。禁止 AI 自由创造事实词。
(function(){
  const BANNED=/保险|友邦|\bAIA\b/i;
  const PERSONALITY=['靠谱','有温度','温暖','暖心','阳光','真诚','理性','务实','长期主义','热爱生活'];
  const CONNECTORS=['说','聊','讲','谈','看'];
  function t(v){return String(v??'').trim();} function uniq(a){return [...new Set(a.filter(Boolean))];}
  function missing(v){return /^(无|没有|暂无|未填|未填写|未设置|未提供|不知道|不详|NA|N\/A|null|none)$/i.test(t(v));}
  function anchors(p){const out=[];if(!missing(p.preferredName))out.push(t(p.preferredName));(p.peerReviewSummary?.topNicknames||[]).forEach(x=>{if(!missing(x?.label))out.push(t(x.label));});const n=t(p.name);if(n){out.push(n);if(n.length===2)out.push(n.slice(1));if(n.length>=3)out.push(n.slice(-2));}return uniq(out).filter(x=>x&&!BANNED.test(x)&&x.length<=8);}
  function pickAnchor(p){const a=anchors(p);return a[0]||'';}
  function personality(p){const source=[t(p.strengths),t(p.personality),...(p.peerReviewSummary?.topImpressions||[]).map(x=>t(x?.label))].join(' ');return PERSONALITY.find(x=>source.includes(x))||'';}
  function education(p){const s=[p.education,p.schoolTier,p.overseas].map(t).join(' ');for(const x of ['博士','硕士','QS前50','QS 前50','QS前100','QS 前100','985','211','海归','留学'])if(s.includes(x))return x.replace('QS 前','QS前');return '';}
  function honor(p){const s=t(p.honors);for(const x of ['TOT','COT','MDRT','销冠'])if(new RegExp(x,'i').test(s))return x;return '';}
  function career(p){const s=t(p.previousCareer);if(!s)return '';const allowed=['律师','医生','教师','老师','教练','精算师','HR','银行人','会计','财务','记者','主持人','程序员','创业者'];return allowed.find(x=>s.includes(x))||'';}
  function safeName(name,anchor){const n=t(name).replace(/\s+/g,'');if(!n||BANNED.test(n)||!anchor||!n.includes(anchor))return '';const count=n.split(anchor).length-1;if(count!==1)return '';return n.slice(0,18);}
  function controlledOptions(profile){const a=pickAnchor(profile);if(!a)return [];const candidates=[];const add=(name,angle,reason)=>{name=safeName(name,a);if(name)candidates.push({name,angle,reason});};
    const job=career(profile);if(job)add(`${job}${a}`,'突出身份',`用真实职业经历强化人物记忆`);
    const trait=personality(profile);if(trait)add(`${trait}${a}`,'突出性格',`使用资料中已有的真实性格特点`);
    const city=t(profile.city);if(city)add(`${city}${a}`,'突出地域',`用真实地域形成识别点`);
    const edu=education(profile);if(edu)add(`${edu}${a}`,'突出学历',`只使用资料明确提供的学历层级`);
    const h=honor(profile);if(h)add(`${h}${a}`,'突出成就',`只使用资料明确提供的真实荣誉`);
    // 基础人物型作为保底，不创造业务词；如已有足够特色则仍保留一个简洁版本。
    add(a,'突出人物',`直接强化稳定的人物称呼`);
    return uniq(candidates.map(x=>JSON.stringify(x))).map(x=>JSON.parse(x)).slice(0,5);
  }
  function enforce(proposal,profile){if(!proposal)return proposal;const controlled=controlledOptions(profile||{});if(controlled.length)proposal.nicknameOptions=controlled;else proposal.nicknameOptions=(proposal.nicknameOptions||[]).filter(x=>!BANNED.test(t(x?.name))).slice(0,3);return proposal;}
  if(typeof renderProposal==='function'){const base=renderProposal;renderProposal=function(proposal,version){enforce(proposal,state.profile||{});return base(proposal,version);};}
  window.aiaNicknamePolicyV1={controlledOptions,enforce,BANNED,PERSONALITY,CONNECTORS};
})();
