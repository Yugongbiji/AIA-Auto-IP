// 昵称受控生成 V2：真实证据只是候选素材；只有“适合成为昵称”的素材才允许进入最终组合。
(function(){
  const BANNED=/保险|友邦|\bAIA\b/i;
  function t(v){return String(v??'').trim();}
  function uniq(a){return [...new Set((a||[]).filter(Boolean))];}
  function missing(v){return /^(无|没有|暂无|未填|未填写|未设置|未提供|不知道|不详|NA|N\/A|null|none)$/i.test(t(v));}
  function anchors(p){
    const out=[];
    if(!missing(p.preferredName))out.push(t(p.preferredName));
    (p.peerReviewSummary?.topNicknames||[]).forEach(x=>{if(!missing(x?.label))out.push(t(x.label));});
    const n=t(p.name);if(n){out.push(n);if(n.length===2)out.push(n.slice(1));if(n.length>=3)out.push(n.slice(-2));}
    return uniq(out).filter(x=>x&&!BANNED.test(x)&&x.length<=8);
  }
  function pickAnchor(p){return anchors(p)[0]||'';}
  function career(p){
    const s=t(p.previousCareer);if(!s)return '';
    const allowed=['律师','医生','教师','老师','教练','精算师','HR','会计','财务','记者','主持人','程序员','环保工程师','工程师','创业者'];
    return allowed.find(x=>s.includes(x))||'';
  }
  function familyIdentity(p){const s=[p.selfIntro,p.identity,p.familyIdentity].map(t).join(' ');return ['二宝妈妈','宝妈','妈妈','宝爸','爸爸'].find(x=>s.includes(x))||'';}
  function doctorate(p){const s=[p.education,p.schoolTier,p.selfIntro].map(t).join(' ');return /博士|PhD|Ph\.D/i.test(s);}
  function strongTrait(p){
    const items=p.peerReviewSummary?.topTraits||p.peerReviewSummary?.topImpressions||[];
    const allowed=['靠谱','真诚','细致','有耐心','理性','务实','有温度','阳光'];
    for(const item of items){const label=t(item?.label??item),count=Number(item?.count||1);if(count>=3&&allowed.includes(label))return label;}
    return '';
  }
  function safeName(name,anchor){const n=t(name).replace(/\s+/g,'');if(!n||BANNED.test(n)||!anchor||!n.includes(anchor))return '';if(n.split(anchor).length-1!==1)return '';return n.slice(0,18);}
  function controlledOptions(profile){
    const a=pickAnchor(profile);if(!a)return [];
    const candidates=[];const add=(name,angle,reason)=>{name=safeName(name,a);if(name&&!candidates.some(x=>x.name===name))candidates.push({name,angle,reason});};
    // 基础人物型永远保留。六种取名思路是“可选模板”，不是六类标签都必须硬塞进昵称。
    add(a,'突出人物','直接强化稳定的人物称呼，最稳妥、最适合长期使用');
    const job=career(profile);if(job)add(`${job}${a}`,'突出身份',`真实职业本身具有识别度，且组合后仍像正常昵称`);
    const family=familyIdentity(profile);if(family)add(`${family}${a}`,'突出身份',`真实生活身份与人物称呼组合，形成清晰记忆点`);
    if(doctorate(profile))add(`Dr.${a}`,'突出学历','仅博士这类可自然昵称化的强学历身份使用；985、211、QS层级不直接拼昵称');
    const trait=strongTrait(profile);if(trait)add(`${trait}的${a}`,'突出性格',`仅多人客户反馈反复出现的性格特点才考虑使用`);
    // 地域、MDRT/COT/TOT、985/211/QS 等即使真实，也默认只作为简介/背书资产，不直接生成“成都XX”“TOTXX”“985XX”。
    return candidates.slice(0,5);
  }
  function enforce(proposal,profile){if(!proposal)return proposal;const controlled=controlledOptions(profile||{});if(controlled.length)proposal.nicknameOptions=controlled;else proposal.nicknameOptions=(proposal.nicknameOptions||[]).filter(x=>!BANNED.test(t(x?.name))).slice(0,3);return proposal;}
  if(typeof renderProposal==='function'){const base=renderProposal;renderProposal=function(proposal,version){enforce(proposal,state.profile||{});return base(proposal,version);};}
  window.aiaNicknamePolicyV1={controlledOptions,enforce,BANNED};
})();
