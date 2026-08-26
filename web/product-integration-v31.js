// V31 阶段验收修复：62-67、69。最终展示与交互收口，不新增业务模块。
(function(){
  const txt=v=>String(v??'').trim();
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  function recruitment(){return /增员|招募|团队/.test(txt(state.profile?.purpose));}

  // 63：准增员选项必须是具体人群特征。
  function fixRecruitmentQuestion(){
    if(!recruitment())return;
    const q=questions.find(x=>x.key==='customerGroups');
    if(q){q.ask='你主要希望吸引哪些类型的准增员对象？可多选；也可以自行输入补充。';q.chips=['宝爸宝妈','高学历人群','自由职业者','企业主','职场白领','专业人士'];}
  }

  // 62：沿用既有悬浮组件的两行文字结构，只做统一视觉；主动清掉方案版本号。
  // 不再用第二个 MutationObserver 反复改 innerHTML，避免与 V30 的观察器互相触发造成页面卡顿。
  function fixFloatButtons(){
    const p=document.querySelector('.ip-floating-profile-button'),s=document.querySelector('.ip-floating-proposal-button');
    if(p){p.classList.add('aia-v31-float');p.setAttribute('aria-label','我的资料');}
    if(s){s.classList.add('aia-v31-float');s.textContent='IP方案';s.setAttribute('aria-label','IP方案');}
  }

  // 67：简介做行级完整性检查；真实素材也不能机械拼积木。
  const loneTrait=/^(靠谱|真诚|细致|有耐心|理性|务实|有温度|温暖|阳光|行动力强|长期主义)$/;
  const hobbyOnly=/^(读书|阅读|美食|旅行|跑步|骑行|健身|摄影|户外)([｜|、](读书|阅读|美食|旅行|跑步|骑行|健身|摄影|户外))*$/;
  function sanitizeLines(lines){
    const out=[];
    (Array.isArray(lines)?lines:[]).map(txt).filter(Boolean).forEach(line=>{
      if(loneTrait.test(line)){if(out.length)out[out.length-1]+=`，${line}`;return;}
      if(hobbyOnly.test(line))return;
      line=line.replace(/^(宝妈|妈妈|二宝妈|宝爸|爸爸)｜([^｜]{2,12}(?:工程师|教师|老师|医生|律师|HR|会计|记者|主持人|程序员))$/, '$1，也是一名$2');
      out.push(line);
    });
    return uniq(out);
  }
  function sanitizeBios(proposal){Object.values(proposal?.bios||{}).flat().forEach(b=>{if(Array.isArray(b?.lines))b.lines=sanitizeLines(b.lines);});}

  // 69：一句话 IP 定位只保留一个最强记忆点，禁止标签串联。
  function anchor(p){return txt(p.preferredName)||txt(p.peerReviewSummary?.topNicknames?.[0]?.label)||txt(p.name);}
  function strongestIdentity(p){
    const career=txt(p.previousCareer).split(/[｜、]/)[0];
    if(career&&career.length<=14)return {kind:'career',value:career};
    const intro=[p.selfIntro,p.identity,p.familyIdentity].map(txt).join(' ');
    for(const x of ['二宝妈妈','宝妈','妈妈','宝爸','爸爸'])if(intro.includes(x))return {kind:'identity',value:x};
    const edu=[p.education,p.schoolTier].map(txt).join(' ');if(/博士/.test(edu))return {kind:'education',value:'博士'};
    return null;
  }
  function safeHeadline(profile){
    const a=anchor(profile);if(!a)return '真实、专业、有辨识度的个人IP';
    const id=strongestIdentity(profile);
    if(!id)return `让人记得住的${a}`;
    if(id.kind==='career')return `从${id.value}跨界而来的${a}`;
    if(id.kind==='education')return `有专业底色的博士${a}`;
    return `${id.value}${a}，分享真实经验与长期成长`;
  }
  function enforceHeadline(proposal){if(proposal)proposal.headline=safeHeadline(state.profile||{});}

  // 64/66：说明按钮跟标题同行；删除旧的长提示。
  function fixProposalDom(){
    const root=document.getElementById('proposal-content');if(!root)return;
    root.querySelectorAll('.nickname-general-note').forEach(n=>n.remove());
    [...root.querySelectorAll('h2,h3,strong')].forEach(h=>{
      if(!/推荐昵称|推荐简介|昵称推荐/.test(txt(h.textContent)))return;
      const section=h.closest('section,article,.proposal-section,.proposal-card,.proposal-block')||h.parentElement;if(!section)return;
      const help=section.querySelector('.compliance-help-button,.proposal-compliance-help,[data-compliance-help]');
      if(help){let row=h.parentElement;if(!row||!row.classList.contains('aia-title-help-row')){row=document.createElement('div');row.className='aia-title-help-row';h.parentNode.insertBefore(row,h);row.appendChild(h);}row.appendChild(help);}
    });
  }

  fixRecruitmentQuestion();fixFloatButtons();
  const basePresent=typeof presentQuestion==='function'?presentQuestion:null;
  if(basePresent)presentQuestion=function(){fixRecruitmentQuestion();return basePresent();};
  const baseRender=typeof renderProposal==='function'?renderProposal:null;
  if(baseRender)renderProposal=function(proposal,version){window.aiaNicknamePolicyV1?.enforce?.(proposal,state.profile||{});sanitizeBios(proposal);enforceHeadline(proposal);const r=baseRender(proposal,version);requestAnimationFrame(()=>requestAnimationFrame(fixProposalDom));return r;};

  if(!document.getElementById('product-integration-v31-style')){const s=document.createElement('style');s.id='product-integration-v31-style';s.textContent=`
  .ip-floating-button.aia-v31-float{width:72px!important;min-width:72px!important;height:56px!important;min-height:56px!important;padding:0 9px!important;border-radius:16px!important;box-shadow:0 8px 22px rgba(60,7,18,.16)!important;transition:transform .15s ease,box-shadow .15s ease!important}
  .ip-floating-button.aia-v31-float:hover{transform:translateY(-1px);box-shadow:0 11px 26px rgba(60,7,18,.2)!important}
  .ip-floating-profile-button.aia-v31-float{background:#fff4f6!important;color:#b30d38!important;border:1px solid #efc7d2!important}
  .ip-floating-proposal-button.aia-v31-float{background:#d31145!important;color:#fff!important;border:1px solid #d31145!important}
  .ip-floating-button.aia-v31-float::before{font-size:16px;line-height:1;margin-bottom:2px}.ip-floating-profile-button.aia-v31-float::before{content:'◉'}.ip-floating-proposal-button.aia-v31-float::before{content:'✦'}
  .aia-title-help-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.aia-title-help-row .compliance-help-button,.aia-title-help-row .proposal-compliance-help,.aia-title-help-row [data-compliance-help]{position:static!important;inset:auto!important;margin-left:auto!important;flex:0 0 auto}
  @media(max-width:720px){.ip-floating-button.aia-v31-float{width:66px!important;min-width:66px!important;height:52px!important;min-height:52px!important;border-radius:15px!important}}
  `;document.head.appendChild(s);}
  window.aiaProductIntegrationV31={fixRecruitmentQuestion,fixFloatButtons,sanitizeLines,safeHeadline,fixProposalDom};
})();
