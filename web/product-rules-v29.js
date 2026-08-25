// 产品规则 V29：只负责原有昵称谨慎审查与展示。
// 客户反馈展示唯一 Owner 是 product-rules-v27.js；本文件不得重复渲染客户反馈。
(function () {
  'use strict';
  const text=value=>String(value??'').trim();
  const uniq=values=>[...new Set((values||[]).filter(Boolean))];
  const missing=value=>/^(无|没有|暂无|未填|未填写|未设置|未提供|不知道|不详|NA|N\/A|null|none)$/i.test(text(value));

  function knownAddresses(profile){const items=[];(profile?.peerReviewSummary?.topNicknames||[]).forEach(item=>{const label=text(item?.label);if(label&&!missing(label))items.push(label);});const preferred=text(profile?.preferredName);if(preferred&&!missing(preferred))items.push(preferred);const name=text(profile?.name);if(name){if(name.length>=3)items.push(name.slice(-2));items.push(name);}return uniq(items).filter(Boolean);}
  function evaluateNickname(name,profile){
    const value=text(name),issues=[],strengths=[];if(!value||missing(value))return{name:value,issues:['当前没有填写昵称'],strengths:[],hasPersonAnchor:false,missing:true};
    if(value.length<=10)strengths.push('长度比较利落，容易记');else if(value.length>14)issues.push('昵称偏长，不容易一次记住');
    if(/保险|友邦|\bAIA\b/i.test(value))issues.push('包含当前推荐规则中的禁用业务/品牌词');
    if(/[©®™]|https?:\/\/|www\.|微信|vx|V信|电话|手机号/i.test(value))issues.push('包含联系方式、链接或导流信息');
    const matched=knownAddresses(profile).filter(address=>address&&value.includes(address));
    const distinct=uniq(matched.filter(a=>a.length>1));if(distinct.length>1)issues.push('一个昵称里出现了两个称呼主体，读起来像把两个名字拼在一起');
    const hasPersonAnchor=distinct.length===1;if(hasPersonAnchor)strengths.push('有稳定的人物称呼，人物识别度较好');
    return{name:value,issues,strengths,hasPersonAnchor,missing:false};
  }
  function auditExistingNicknames(profile){window.aiaProfileRulesV27?.normalizeSignupProfile?.(profile);const rawVideo=text(profile?.videoNickname),rawXhs=text(profile?.xiaohongshuNickname);const video=missing(rawVideo)?'':rawVideo,xhs=missing(rawXhs)?'':rawXhs;const candidates=uniq([video,xhs]).filter(Boolean).map(name=>evaluateNickname(name,profile));const same=!!(video&&xhs&&video===xhs);const good=candidates.filter(item=>!item.issues.length&&item.hasPersonAnchor);return{video,xhs,same,candidates,preferred:good[0]?.name||''};}
  function nicknamePanelTarget(content){const heading=[...content.querySelectorAll('h2,h3,strong')].find(node=>/推荐昵称|昵称推荐/.test(text(node.textContent)));if(!heading)return null;return heading.closest('section,article,.proposal-section,.proposal-card,.proposal-block')||heading.parentElement;}
  function renderNicknameAuditInPlace(){
    const content=document.getElementById('proposal-content');if(!content)return;content.querySelector('.nickname-audit-card')?.remove();content.querySelector('.nickname-general-note')?.remove();const target=nicknamePanelTarget(content);if(!target)return;const audit=auditExistingNicknames(state.profile||{});
    if(audit.video||audit.xhs){const card=document.createElement('section');card.className='proposal-card nickname-audit-card';const h=document.createElement('h3');h.textContent='现有昵称建议';card.appendChild(h);const current=document.createElement('p');current.className='nickname-audit-current';current.textContent=[audit.video&&`视频号：${audit.video}`,audit.xhs&&`小红书：${audit.xhs}`].filter(Boolean).join('　');card.appendChild(current);if(audit.video&&audit.xhs&&!audit.same){const p=document.createElement('p');p.textContent='两个平台现在用的昵称不一样。建议统一为同一个长期昵称，减少用户识别成本。';card.appendChild(p);}audit.candidates.forEach(item=>{const p=document.createElement('p');if(item.issues.length){p.textContent=`“${item.name}”暂不建议直接改掉，但有以下问题需要留意：${item.issues.map((x,i)=>`${i+1}. ${x}`).join(' ')}。如果这个昵称已经长期使用并有用户记忆，修改前应更谨慎。`;}else if(item.hasPersonAnchor){p.textContent=`“${item.name}”目前没有发现充分理由需要修改，建议优先保留，再把推荐昵称作为备选比较。`;}else{p.textContent=`“${item.name}”没有明显硬伤，但人物识别度一般。是否修改要结合已有用户记忆和这个名字对你的特殊意义。`;}card.appendChild(p);});target.parentNode.insertBefore(card,target);}
    const note=document.createElement('p');note.className='nickname-general-note';note.textContent='AI 推荐昵称仅供参考。标准化推荐不一定最能代表你；你最喜欢、最愿意长期使用、对你有特殊含义的名字，也可能就是最好的昵称。';const heading=[...target.querySelectorAll('h2,h3,strong')].find(node=>/推荐昵称|昵称推荐/.test(text(node.textContent)));(heading?.parentElement||target).appendChild(note);
  }

  const baseRenderProposal=renderProposal;renderProposal=function renderProposalV29(proposal,version){const result=baseRenderProposal(proposal,version);requestAnimationFrame(()=>requestAnimationFrame(renderNicknameAuditInPlace));return result;};
  if(!document.getElementById('product-rules-v29-style')){const style=document.createElement('style');style.id='product-rules-v29-style';style.textContent='.nickname-general-note{margin:10px 0 0;padding:10px 12px;border-radius:10px;background:#f7f4f5;color:#6a5f63;font-size:13px;line-height:1.6}';document.head.appendChild(style);}
  window.aiaProductRulesV29=Object.freeze({evaluateNickname,auditExistingNicknames,renderNicknameAuditInPlace,ownsNicknameOptions:false,ownsPeerFeedback:false});
})();
