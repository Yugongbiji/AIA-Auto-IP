// V33：70-74 最终收口。减少机械标签拼接，恢复信息量与固定合规结构。
(function(){
  const txt=v=>String(v??'').trim();
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const split=v=>txt(v).split(/[｜|、,，;；/\n]+/).map(x=>x.trim()).filter(Boolean);

  function specificFamilyIdentity(p){
    const s=[p?.lifeRoles,p?.familyIdentity,p?.selfIntro].map(txt).join(' ');
    for(const x of ['二孩宝妈','二宝妈妈','二孩妈妈','二宝爸','二孩爸爸','宝妈','妈妈','宝爸','爸爸']) if(s.includes(x)) return x;
    return '';
  }
  function career(p){
    const direct=split(p?.previousCareer)[0]; if(direct) return direct;
    const s=txt(p?.selfIntro);
    for(const x of ['环保工程师','工程师','教师','老师','医生','律师','HR','财务','银行从业者','创业者','会计','记者','主持人','程序员']) if(s.includes(x)) return x;
    return '';
  }
  function proofItems(p){
    const out=[];
    const edu=[txt(p?.schoolTier),txt(p?.education),txt(p?.overseas)].filter(Boolean).join(' ');
    if(/博士/.test(edu)) out.push('博士背景');
    else if(/硕士/.test(edu)) out.push('硕士背景');
    else if(/985/.test(edu)) out.push('985高校背景');
    else if(/211/.test(edu)) out.push('211高校背景');
    else if(/QS\s*前?\s*100/i.test(edu)) out.push('QS前100高校背景');
    if(txt(p?.insuranceYears)) out.push(`${txt(p.insuranceYears).replace(/年$/,'')}年从业经历`);
    const honors=split(p?.honors).filter(v=>/MDRT|COT|TOT|五星/i.test(v)); if(honors[0]) out.push(honors[0]);
    return uniq(out).slice(0,2);
  }
  function feedbackTraits(p){
    const items=p?.peerReviewSummary?.topTraits||p?.peerReviewSummary?.topImpressions||[];
    const out=[];
    for(const item of items){const label=txt(item?.label??item),count=Number(item?.count||1);if(label&&count>=2&&!out.includes(label))out.push(label);if(out.length>=2)break;}
    return out;
  }
  function realServices(p){
    return uniq(['services','serviceAreas','serviceCapabilities','expertise','specialties'].flatMap(k=>split(p?.[k]))).slice(0,4);
  }
  function naturalIdentity(p){
    const family=specificFamilyIdentity(p),job=career(p);
    if(family&&job) return `${family}，曾从事${job}`;
    return family||job||'';
  }

  // 70/74：一句话定位不带称呼；保险必须是主内容，支线素材不能反客为主。
  function safeHeadline(p){
    const job=career(p),family=specificFamilyIdentity(p);
    if(job) return `从${job}跨界，持续分享保险、家庭保障与长期规划`;
    if(family) return `从${family}视角，分享保险、家庭保障与长期规划`;
    const proof=proofItems(p)[0];
    if(proof) return `用${proof}做底色，讲清保险、家庭保障与长期规划`;
    return '围绕保险、家庭保障与长期规划，分享实用而真实的内容';
  }

  const XHS_BANNED=/保险|金融|理财|贷款|股票|基金|医疗|护理|教育|玄学|友邦|\bAIA\b|微信|手机号|电话|QQ|微博|二维码|私信|关注.*送|稳赚|无风险|财富自由|财富密码|躺赢/i;
  const xhsSafe=v=>txt(v)&&!XHS_BANNED.test(txt(v));
  const line=(emoji,value)=>txt(value)?`${emoji} ${txt(value)}`:'';
  const XHS_DISCLAIMER='📌 本账号所述内容为个人意见，不代表任何官方意见。';
  const VIDEO_DISCLAIMER='📌 本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见。';

  function commonAssets(p){return {identity:naturalIdentity(p),proof:proofItems(p),traits:feedbackTraits(p),services:realServices(p)};}
  function mainContent(platform){return platform==='xhs'?'分享家庭保障、养老准备与长期规划相关内容':'分享保险、家庭保障、养老与长期规划相关内容';}
  function xhsVersions(p){
    const a=commonAssets(p),identity=xhsSafe(a.identity)?a.identity:'',proof=a.proof.filter(xhsSafe),traits=a.traits.filter(xhsSafe),services=a.services.filter(xhsSafe);
    const trust=traits.length?`客户常提到：${traits.join('、')}`:'';
    return [
      {label:'方案 A · 专业背书',focus:'我是谁 + 为什么值得相信',lines:uniq([line('👤',identity),line('🏅',proof.join('｜')),line('💬',mainContent('xhs')),line('✨',trust),XHS_DISCLAIMER]).filter(Boolean)},
      {label:'方案 B · 人设记忆',focus:'让别人先记住这个人',lines:uniq([line('👤',identity),line('✨',trust),line('🏅',proof[0]||''),line('💬',mainContent('xhs')),XHS_DISCLAIMER]).filter(Boolean)},
      {label:'方案 C · 价值服务',focus:'我能给你带来什么',lines:uniq([line('👤',identity),services.length?line('🧭',services.join('｜')):'',line('💬',mainContent('xhs')),line('🏅',proof.join('｜')),XHS_DISCLAIMER]).filter(Boolean)}
    ];
  }
  function videoCompliance(p){
    const lines=[];
    if(txt(p?.department)) lines.push(`📍 ${txt(p.department)}`);
    lines.push('📌 执业编号：000');
    lines.push(VIDEO_DISCLAIMER);
    return lines;
  }
  function videoVersions(p){
    const a=commonAssets(p),trust=a.traits.length?`客户常提到：${a.traits.join('、')}`:'',req=videoCompliance(p);
    const mk=(label,focus,body)=>({label,focus,lines:uniq([...body.filter(Boolean),...req])});
    return [
      mk('方案 A · 专业背书','我是谁 + 为什么值得相信',[line('👤',a.identity),line('🏅',a.proof.join('｜')),line('💬',mainContent('video')),line('✨',trust)]),
      mk('方案 B · 人设记忆','让别人先记住这个人',[line('👤',a.identity),line('✨',trust),line('🏅',a.proof[0]||''),line('💬',mainContent('video'))]),
      mk('方案 C · 价值服务','我能给你带来什么',[line('👤',a.identity),a.services.length?line('🧭',a.services.join('｜')):'',line('💬',mainContent('video')),line('🏅',a.proof.join('｜'))])
    ];
  }
  function enforceProposal(proposal,p){
    if(!proposal)return;
    proposal.headline=safeHeadline(p||{});
    proposal.bios=proposal.bios||{};
    proposal.bios.xiaohongshu=xhsVersions(p||{});
    proposal.bios.videoDouyin=videoVersions(p||{});
  }

  // 71：两个悬浮入口只保留图标，文字完全移除。
  function icon(kind){return kind==='profile'?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c.7-4 3-6 7-6s6.3 2 7 6"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg>';}
  function iconOnlyFloats(){
    const p=document.querySelector('.ip-floating-profile-button'),s=document.querySelector('.ip-floating-proposal-button');
    [[p,'profile','我的资料'],[s,'proposal','IP方案']].forEach(([b,k,label])=>{if(!b)return;b.classList.add('aia-v33-icon-float');b.innerHTML=icon(k);b.setAttribute('aria-label',label);b.setAttribute('title',label);});
  }

  // 73：首次复制只出现完整合规弹窗；沿用“可以说 / 不可以说”的原有合规内容，不再给“返回检查”。
  const seen={nickname:false,bio:false};
  function complianceData(){
    try{return COMPLIANCE_TIPS;}catch(_){return {allowed:[{emoji:'✅',title:'真实信息',text:'可表达真实个人经历、城市、专业服务方向与已获得的荣誉。'}],avoid:[{emoji:'⛔',title:'联系方式与导流',text:'不要写联系方式、链接或明显导流信息。'}]};}
  }
  function closeModal(back){back?.remove();document.body.classList.remove('copy-reminder-open');}
  function showCompliance(kind,textValue,button){
    const data=complianceData(),back=document.createElement('div');back.className='copy-reminder-backdrop aia-v33-compliance-backdrop';
    const card=document.createElement('section');card.className='copy-reminder-modal aia-v33-compliance-modal';
    const title=document.createElement('h3');title.textContent=kind==='nickname'?'复制昵称前，请先看一眼合规提示':'复制简介前，请先看一眼合规提示';
    const grid=document.createElement('div');grid.className='aia-v33-compliance-grid';
    const make=(heading,items,cls)=>{const col=document.createElement('section');col.className=`aia-v33-compliance-col ${cls}`;const h=document.createElement('h4');h.textContent=heading;col.appendChild(h);(items||[]).forEach(item=>{const row=document.createElement('div');row.className='aia-v33-compliance-item';row.innerHTML=`<span>${item.emoji||''}</span><div><strong>${item.title||''}</strong><p>${item.text||''}</p></div>`;col.appendChild(row);});return col;};
    grid.append(make('可以说',data.allowed,'is-allowed'),make('不可以说',data.avoid,'is-avoid'));
    const actions=document.createElement('div');actions.className='copy-reminder-actions';const ok=document.createElement('button');ok.type='button';ok.className='primary';ok.textContent='我已了解，继续复制';ok.onclick=()=>{seen[kind]=true;closeModal(back);navigator.clipboard?.writeText(textValue).then(()=>{const old=button.textContent;button.textContent='已复制';setTimeout(()=>button.textContent=old,1200);});};actions.appendChild(ok);card.append(title,grid,actions);back.appendChild(card);document.body.appendChild(back);document.body.classList.add('copy-reminder-open');ok.focus();
  }
  function replaceCopyButton(oldButton,kind,textValue){
    if(!oldButton||oldButton.dataset.aiaV33Copy==='1')return;
    const button=oldButton.cloneNode(true);button.dataset.aiaV33Copy='1';oldButton.replaceWith(button);
    button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();if(!seen[kind]){showCompliance(kind,textValue,button);return;}navigator.clipboard?.writeText(textValue).then(()=>{const old=button.textContent;button.textContent='已复制';setTimeout(()=>button.textContent=old,1200);});},true);
  }
  function rebindCopyButtons(){
    const root=document.getElementById('proposal-content');if(!root)return;
    root.querySelectorAll('.nickname-option').forEach(row=>replaceCopyButton(row.querySelector('.copy-button'),'nickname',txt(row.querySelector('strong')?.textContent)));
    root.querySelectorAll('.bio-copy-block').forEach(block=>replaceCopyButton(block.querySelector('.copy-button'),'bio',block.querySelector('textarea')?.value||''));
  }

  const baseRender=typeof renderProposal==='function'?renderProposal:null;
  if(baseRender)renderProposal=function(proposal,version){enforceProposal(proposal,state.profile||{});const result=baseRender(proposal,version);requestAnimationFrame(()=>requestAnimationFrame(()=>{iconOnlyFloats();rebindCopyButtons();}));return result;};
  // 老集成层仍可能在 DOM 变化时写回文字；轻量观察只在悬浮容器变化时收口为纯图标。
  const floatRoot=document.querySelector('.ip-floating-actions');if(floatRoot)new MutationObserver(iconOnlyFloats).observe(floatRoot,{childList:true,subtree:true});
  iconOnlyFloats();

  if(!document.getElementById('product-integration-v33-style')){const s=document.createElement('style');s.id='product-integration-v33-style';s.textContent=`
    .ip-floating-button.aia-v33-icon-float{width:48px!important;min-width:48px!important;height:48px!important;min-height:48px!important;padding:0!important;border-radius:50%!important;display:grid!important;place-items:center!important}
    .ip-floating-button.aia-v33-icon-float svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    .aia-v33-compliance-modal{width:min(820px,100%)}.aia-v33-compliance-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.aia-v33-compliance-col{border:1px solid #eee;border-radius:14px;padding:14px}.aia-v33-compliance-col h4{margin:0 0 10px}.aia-v33-compliance-col.is-allowed{background:#f7fbf8}.aia-v33-compliance-col.is-avoid{background:#fff7f8}.aia-v33-compliance-item{display:flex;gap:9px;padding:9px 0;border-top:1px solid rgba(0,0,0,.06)}.aia-v33-compliance-item:first-of-type{border-top:0}.aia-v33-compliance-item strong{display:block;font-size:13px}.aia-v33-compliance-item p{margin:3px 0 0;font-size:12px;line-height:1.55;color:#666}.aia-v33-compliance-modal .copy-reminder-actions{justify-content:center}.aia-v33-compliance-modal .copy-reminder-actions .primary{min-width:180px}
    @media(max-width:620px){.aia-v33-compliance-grid{grid-template-columns:1fr}.aia-v33-compliance-modal{max-height:82vh}}
  `;document.head.appendChild(s);}
  window.aiaProductIntegrationV33={safeHeadline,enforceProposal,xhsVersions,videoVersions,iconOnlyFloats,rebindCopyButtons};
})();
