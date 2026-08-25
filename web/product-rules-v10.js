// 产品规则 V10（纯 UI Owner）：只负责昵称/简介复制前的合规提醒与 ? 帮助按钮。
// 严禁修改 proposal / textarea / 简介正文；最终简介只能由 ip-policy-core.js 生成。
(function(){
  'use strict';
  const seen={nickname:false,bio:false};
  const REMINDERS=[
    '小红书个人简介：7 天内最多修改 3 次，频繁修改也可能影响账号稳定。',
    '微信视频号昵称：每年最多可修改 5 次。',
    '微信视频号简介：目前没有明确的修改次数限制。'
  ];
  const COMPLIANCE={
    nickname:{can:['使用本人真实、长期稳定的人物称呼或名字线索','使用真实且不过度夸大的个人特色','不同平台尽量使用同一个昵称，减少频繁修改'],cannot:['使用联系方式、链接或明显导流信息','虚构或夸大学历、职业、荣誉、地域等资料','使用不符合当前公司/平台合规规则的敏感表达']},
    bio:{can:['使用本人真实身份、经历、客户反馈和真实可提供的服务','小红书简介最后保留固定个人意见声明','视频号/抖音按固定顺序展示个人意见声明、营销服务部、执业证编号'],cannot:['小红书简介出现保险、金融、理财、贷款、股票、基金、医疗、护理、教育、玄学等敏感行业词','在简介留下微信号、手机号、邮箱、QQ等联系方式或利益诱导','把营销员编号当成执业证编号，或重复输出执业编号/合规声明']}
  };
  const t=v=>String(v??'').trim();

  function close(node){node?.remove();document.body.classList.remove('copy-reminder-open');}
  async function write(text,button){if(window.aiaClipboard?.copyWithFeedback)return window.aiaClipboard.copyWithFeedback(text,button);if(typeof copyText==='function')return copyText(text,button);window.aiaToast?.('复制失败，请重试','error');return false;}
  function simpleModal(title,lines,confirm,onConfirm){
    const back=document.createElement('div');back.className='copy-reminder-backdrop';back.setAttribute('role','dialog');back.setAttribute('aria-modal','true');
    const card=document.createElement('section');card.className='copy-reminder-modal';const h=document.createElement('h3');h.textContent=title;card.appendChild(h);
    const ul=document.createElement('ul');lines.forEach(text=>{const li=document.createElement('li');li.textContent=text;ul.appendChild(li);});card.appendChild(ul);
    const actions=document.createElement('div');actions.className='copy-reminder-actions';const ok=document.createElement('button');ok.type='button';ok.className='primary';ok.textContent=confirm;ok.onclick=()=>{close(back);onConfirm?.();};actions.appendChild(ok);card.appendChild(actions);back.appendChild(card);document.body.appendChild(back);document.body.classList.add('copy-reminder-open');ok.focus();
  }
  function complianceModal(kind,text,button,copyAfter=true){
    const cfg=COMPLIANCE[kind]||COMPLIANCE.bio;const back=document.createElement('div');back.className='copy-reminder-backdrop';back.setAttribute('role','dialog');back.setAttribute('aria-modal','true');
    const card=document.createElement('section');card.className='copy-reminder-modal aia-compliance-modal';const h=document.createElement('h3');h.textContent=kind==='nickname'?'昵称合规提示 ⚠️':'简介合规提示 ⚠️';card.appendChild(h);
    const grid=document.createElement('div');grid.className='aia-compliance-grid';[['可以说',cfg.can,'aia-compliance-can'],['不可以说',cfg.cannot,'aia-compliance-cannot']].forEach(([title,items,cls])=>{const col=document.createElement('section');col.className=`aia-compliance-column ${cls}`;const hh=document.createElement('h4');hh.textContent=title;const ul=document.createElement('ul');items.forEach(x=>{const li=document.createElement('li');li.textContent=x;ul.appendChild(li);});col.append(hh,ul);grid.appendChild(col);});card.appendChild(grid);
    const actions=document.createElement('div');actions.className='copy-reminder-actions';const ok=document.createElement('button');ok.type='button';ok.className='primary';ok.textContent=copyAfter?'我已了解，继续复制':'我知道了';ok.onclick=async()=>{close(back);if(copyAfter){seen[kind]=true;await write(text,button);}};actions.appendChild(ok);card.appendChild(actions);back.appendChild(card);document.body.appendChild(back);document.body.classList.add('copy-reminder-open');ok.focus();
  }
  function firstCopy(kind,text,button){simpleModal('复制前先提醒一下 📌',REMINDERS,'下一步：查看合规',()=>complianceModal(kind,text,button,true));}
  function bind(button,kind,text){if(!button||button.dataset.copyReminderBound==='1')return;button.dataset.copyReminderBound='1';button.addEventListener('click',e=>{if(seen[kind])return;e.preventDefault();e.stopImmediatePropagation();firstCopy(kind,text,button);},true);}
  function help(content,kind){
    const pattern=kind==='nickname'?/推荐昵称|昵称推荐/:/简介/;const heading=[...content.querySelectorAll('h2,h3,strong')].find(n=>pattern.test(t(n.textContent)));if(!heading)return;
    const card=heading.closest('.proposal-card,section,article')||heading.parentElement;if(!card||card.querySelector(`.aia-compliance-help[data-kind="${kind}"]`))return;
    card.classList.add('aia-compliance-help-host');const b=document.createElement('button');b.type='button';b.className='aia-compliance-help';b.dataset.kind=kind;b.textContent='?';b.setAttribute('aria-label',kind==='nickname'?'查看昵称合规提示':'查看简介合规提示');b.title=b.getAttribute('aria-label');b.onclick=()=>complianceModal(kind,'',b,false);card.appendChild(b);
  }
  function normalizeRecommendationLabels(content){
    const cols=[...content.querySelectorAll('.platform-column')];const hs=cols.map(c=>c.querySelector('h4'));
    if(hs[0])hs[0].textContent='小红书简介 · 推荐版';if(hs[1])hs[1].textContent='视频号 / 抖音简介 · 推荐版';
    cols.forEach(col=>[...col.querySelectorAll('.bio-copy-block')].slice(1).forEach(node=>node.remove()));
    content.querySelectorAll('.license-note').forEach(node=>{if(/000/.test(t(node.textContent)))node.remove();});
  }
  function enhance(content){
    normalizeRecommendationLabels(content);content.querySelector('.ip-compliance-fold')?.remove();content.querySelectorAll('.compliance-card,.platform-reminders').forEach(n=>n.classList.add('aia-compliance-source-hidden'));
    help(content,'nickname');help(content,'bio');content.querySelectorAll('.nickname-option').forEach(r=>bind(r.querySelector('.copy-button'),'nickname',r.querySelector('strong')?.textContent?.trim()||''));content.querySelectorAll('.bio-copy-block').forEach(b=>bind(b.querySelector('.copy-button'),'bio',b.querySelector('textarea')?.value||''));
  }
  if(typeof renderProposal==='function'){const base=renderProposal;renderProposal=function productRulesV10ComplianceOnly(proposal,version){const result=base(proposal,version);const content=document.getElementById('proposal-content');if(content)enhance(content);return result;};}
  if(!document.getElementById('compliance-v10-redesign-style')){const s=document.createElement('style');s.id='compliance-v10-redesign-style';s.textContent='.aia-compliance-source-hidden{display:none!important}.aia-compliance-help-host{position:relative!important}.aia-compliance-help{position:absolute!important;top:16px;right:16px;display:inline-grid;place-items:center;width:28px;min-width:28px;height:28px;min-height:28px;padding:0;border-radius:50%;border:1px solid #eadde1;background:#fff7f9;color:#9e2444;font-size:15px;font-weight:800;line-height:1;cursor:pointer}.aia-compliance-help:hover{border-color:#d8b7c1;background:#fff1f5}.aia-compliance-help:focus-visible{outline:3px solid #d3114540;outline-offset:2px}.aia-compliance-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:14px 0}.aia-compliance-column{padding:14px;border-radius:12px}.aia-compliance-can{background:#f4fbf7}.aia-compliance-cannot{background:#fff5f6}.aia-compliance-column h4{margin:0 0 8px}.aia-compliance-column ul{margin:0;padding-left:20px}@media(max-width:720px){.aia-compliance-help{top:12px;right:12px}.aia-compliance-grid{grid-template-columns:1fr}}';document.head.appendChild(s);}
  window.aiaComplianceUiV10=Object.freeze({complianceModal,firstCopy,ownsClipboard:false,ownsBioText:false});
})();
