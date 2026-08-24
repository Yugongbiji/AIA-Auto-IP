// 产品规则 V10：首次复制先提醒修改次数，再强制查看合规；简介最终展示做受控兜底。
(function () {
  const reminderSeen={nickname:false,bio:false};
  const FIXED_REMINDERS=['小红书个人简介：7 天内最多修改 3 次，频繁修改也可能影响账号稳定。','微信视频号昵称：每年最多可修改 5 次。','微信视频号简介：目前没有明确的修改次数限制。'];
  const COMPLIANCE={nickname:['昵称不要出现“保险”“友邦”“AIA”等禁用表达。','不要使用联系方式、链接或明显导流信息。','学历、职业、荣誉、地域等只能使用本人真实资料，不得推断或夸大。'],bio:['小红书简介不得出现保险、金融、理财、联系方式、引流或友邦/AIA。','学历、职业、荣誉、服务内容等必须来自本人真实资料。','不同平台按对应合规要求使用声明和必要信息。']};
  const XHS_BANNED=/保险|金融|理财|贷款|股票|基金|医疗|护理|教育|玄学|友邦|\bAIA\b|微信|手机号|电话|QQ|微博|二维码|私信|关注.*送|稳赚|无风险|财富自由|财富密码|躺赢|第一|最好|保证/i;
  const PERSONALITY=['靠谱','真诚','细致','有耐心','理性','务实','有温度','温暖','阳光','行动力强','长期主义'];
  function t(v){return String(v??'').trim();}
  function split(v){return t(v).split(/[｜|、,，;；/\n]+/).map(x=>x.trim()).filter(Boolean);}
  function uniq(a){return [...new Set((a||[]).filter(Boolean))];}
  function first(profile,keys){for(const key of keys){if(t(profile?.[key]))return t(profile[key]);}return '';}
  function assets(profile){
    const identity=uniq([...split(profile?.lifeRoles),...split(profile?.previousCareer),t(profile?.city)]).slice(0,2);
    const pro=[]; const edu=uniq([t(profile?.schoolTier),t(profile?.education),t(profile?.overseas)]).filter(v=>v&&!/^(本科|有|没有|不希望填写|跳过)$/.test(v)); pro.push(...edu.slice(0,1));
    if(t(profile?.insuranceYears))pro.push(`${t(profile.insuranceYears).replace(/年$/,'')}年从业经历`);
    pro.push(...split(profile?.honors).slice(0,1));
    const traitSource=[t(profile?.strengths),t(profile?.personality),...(profile?.peerReviewSummary?.topTraits||[]).map(x=>t(x?.label))].join(' ');
    const trait=PERSONALITY.find(x=>traitSource.includes(x))||'';
    const hobbies=split(profile?.hobbies).slice(0,2);
    const services=uniq(['services','serviceAreas','serviceCapabilities','expertise','specialties'].flatMap(k=>split(profile?.[k]))).slice(0,4);
    return {identity,pro:uniq(pro).slice(0,2),trait,hobbies,services};
  }
  function safeXhs(value){return t(value)&&!XHS_BANNED.test(t(value));}
  function line(emoji,value){return t(value)?`${emoji} ${t(value)}`:'';}
  function valueTopic(a){const pool=[...a.services,...a.hobbies,...a.identity];return pool.find(safeXhs)||'';}
  function buildXhs(profile){
    const a=assets(profile),id=a.identity.filter(safeXhs).join('｜'),pro=a.pro.filter(safeXhs).join('｜'),topic=valueTopic(a),trait=safeXhs(a.trait)?a.trait:'';
    const disclaimer='📌 本账号所述内容为个人意见，不代表任何官方意见。';
    const A={label:'方案 A · 专业背书',focus:'我是谁 + 为什么值得相信',lines:uniq([line('👤',id),line('🏅',pro),topic?line('💬',`分享${topic}相关的真实经验`):'💬 分享真实经历与实用经验',disclaimer]).filter(Boolean)};
    const B={label:'方案 B · 人设记忆',focus:'让别人先记住这个人',lines:uniq([line('👤',id),line('✨',trait),a.hobbies.filter(safeXhs).length?line('🌿',a.hobbies.filter(safeXhs).join('｜')):'',topic?line('💬',`持续分享${topic}相关内容`):'💬 分享真实生活与成长',disclaimer]).filter(Boolean)};
    const serviceTags=a.services.filter(safeXhs).slice(0,4); const C={label:'方案 C · 价值服务',focus:'我能给你带来什么',lines:uniq([line('👤',id),serviceTags.length?line('🧭',serviceTags.join('｜')):'',topic?line('💬',`围绕${topic}分享实用内容`):'💬 分享真实经验与实用方法',pro?line('🏅',pro):'',disclaimer]).filter(Boolean)};
    return [A,B,C];
  }
  function videoComplianceLines(proposal,profile){
    const existing=(proposal?.bios?.videoDouyin||[]).flatMap(x=>Array.isArray(x?.lines)?x.lines:[]); const required=uniq(existing.filter(x=>/营销服务部|执业编号|本账号上所陈述|个人意见/.test(t(x))));
    if(!required.some(x=>/营销服务部/.test(x))&&t(profile?.department))required.unshift(`📍 ${t(profile.department)}`);
    if(!required.some(x=>/执业编号/.test(x)))required.push('📌 执业编号：000');
    if(!required.some(x=>/本账号上所陈述|个人意见/.test(x)))required.push('📌 本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见。');
    return required;
  }
  function buildVideo(proposal,profile){
    const a=assets(profile),id=a.identity.join('｜'),pro=a.pro.join('｜'),topic=a.services[0]||a.hobbies[0]||a.identity[0]||'',required=videoComplianceLines(proposal,profile);
    const mk=(label,focus,body)=>({label,focus,lines:uniq([...body.filter(Boolean),...required])});
    return [
      mk('方案 A · 专业背书','我是谁 + 为什么值得相信',[line('👤',id),line('🏅',pro),topic?line('💬',`分享${topic}相关经验`):'💬 分享真实经历与实用经验']),
      mk('方案 B · 人设记忆','让别人先记住这个人',[line('👤',id),line('✨',a.trait),a.hobbies.length?line('🌿',a.hobbies.join('｜')):'',topic?line('💬',`持续分享${topic}相关内容`):'']),
      mk('方案 C · 价值服务','我能给你带来什么',[line('👤',id),a.services.length?line('🧭',a.services.slice(0,4).join('｜')):'',topic?line('💬',`围绕${topic}分享实用内容`):'💬 分享真实经验与实用方法',line('🏅',pro)])
    ];
  }
  function enforceBios(proposal,profile){if(!proposal||!profile)return;proposal.bios=proposal.bios||{};proposal.bios.xiaohongshu=buildXhs(profile);proposal.bios.videoDouyin=buildVideo(proposal,profile);}
  function close(modal){modal?.remove();document.body.classList.remove('copy-reminder-open');}
  function copied(button){const old=button.textContent;button.textContent='已复制';setTimeout(()=>button.textContent=old,1200);}
  function write(text,button){navigator.clipboard?.writeText(text).then(()=>copied(button)).catch(()=>button.textContent='请手动复制');}
  function modal(title,lines,confirmText,onConfirm,cancelText='先看看'){const back=document.createElement('div');back.className='copy-reminder-backdrop';back.setAttribute('role','dialog');back.setAttribute('aria-modal','true');const card=document.createElement('section');card.className='copy-reminder-modal';card.innerHTML=`<h3>${title}</h3>`;const ul=document.createElement('ul');lines.forEach((s)=>{const li=document.createElement('li');li.textContent=s;ul.appendChild(li);});const actions=document.createElement('div');actions.className='copy-reminder-actions';const cancel=document.createElement('button');cancel.type='button';cancel.className='secondary-button';cancel.textContent=cancelText;cancel.onclick=()=>close(back);const ok=document.createElement('button');ok.type='button';ok.className='primary';ok.textContent=confirmText;ok.onclick=()=>{close(back);onConfirm?.();};actions.append(cancel,ok);card.append(ul,actions);back.appendChild(card);document.body.appendChild(back);document.body.classList.add('copy-reminder-open');ok.focus();return back;}
  function showCompliance(kind,text,button,copyAfter=true){modal(kind==='nickname'?'昵称合规提示 ⚠️':'简介合规提示 ⚠️',COMPLIANCE[kind]||[],copyAfter?'我已了解，继续复制':'我知道了',()=>{if(copyAfter){reminderSeen[kind]=true;write(text,button);}},'返回检查');}
  function showFirst(kind,text,button){modal('复制前先提醒一下 📌',FIXED_REMINDERS,'下一步：查看合规',()=>showCompliance(kind,text,button,true),'先不复制');}
  function bind(button,kind,text){if(!button||button.dataset.copyReminderBound==='1')return;button.dataset.copyReminderBound='1';button.addEventListener('click',(event)=>{if(reminderSeen[kind])return;event.preventDefault();event.stopImmediatePropagation();showFirst(kind,text,button);},true);}
  function removeOldFold(content){content.querySelector('.ip-compliance-fold')?.remove();content.querySelectorAll('.compliance-card,.platform-reminders').forEach(node=>node.classList.add('aia-compliance-source-hidden'));}
  function headingTarget(content,kind){const pattern=kind==='nickname'?/推荐昵称|昵称推荐/:/简介/;return [...content.querySelectorAll('h2,h3,strong')].find(node=>pattern.test(t(node.textContent)));}
  function addHelp(content,kind){const heading=headingTarget(content,kind);if(!heading||heading.parentElement?.querySelector(`.aia-compliance-help[data-kind="${kind}"]`))return;const button=document.createElement('button');button.type='button';button.className='aia-compliance-help';button.dataset.kind=kind;button.textContent='?';button.setAttribute('aria-label',kind==='nickname'?'查看昵称合规提示':'查看简介合规提示');button.title=button.getAttribute('aria-label');button.onclick=()=>showCompliance(kind,'',button,false);heading.parentElement?.classList.add('aia-compliance-heading');heading.parentElement?.appendChild(button);}
  function appendThirdBio(content,proposal){const columns=[...content.querySelectorAll('.platform-column')];if(typeof addCopyBlock!=='function'||columns.length<2)return;[[columns[0],proposal?.bios?.xiaohongshu?.[2],'小红书'],[columns[1],proposal?.bios?.videoDouyin?.[2],'视频号 / 抖音']].forEach(([column,item,platform])=>{if(item&&column.querySelectorAll('.bio-copy-block').length<3)addCopyBlock(column,item,platform);});}
  function enhance(content,proposal){appendThirdBio(content,proposal);removeOldFold(content);addHelp(content,'nickname');addHelp(content,'bio');content.querySelectorAll('.nickname-option').forEach(row=>bind(row.querySelector('.copy-button'),'nickname',row.querySelector('strong')?.textContent?.trim()||''));content.querySelectorAll('.bio-copy-block').forEach(block=>bind(block.querySelector('.copy-button'),'bio',block.querySelector('textarea')?.value||''));}
  if(typeof renderProposal==='function'){const base=renderProposal;renderProposal=function(proposal,version){enforceBios(proposal,state.profile||{});const result=base(proposal,version);const content=document.getElementById('proposal-content');if(content)enhance(content,proposal);return result;};}
  if(!document.getElementById('compliance-v10-redesign-style')){const style=document.createElement('style');style.id='compliance-v10-redesign-style';style.textContent='.aia-compliance-source-hidden{display:none!important}.aia-compliance-heading{position:relative}.aia-compliance-help{position:absolute;right:0;top:0;width:26px;height:26px;border-radius:50%;border:1px solid #d9c5cb;background:#fff7f9;color:#b20f3b;font-weight:800;cursor:pointer}';document.head.appendChild(style);}
  window.aiaBioPolicyV1={enforceBios,buildXhs,buildVideo,assets};
})();
