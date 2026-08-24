// 产品规则 V29（展示层）：客户反馈结构化展示 + 原有昵称谨慎审查。
// 不生成 nicknameOptions，不修改简介/内容方向。
(function () {
  'use strict';
  const text=value=>String(value??'').trim();
  const uniq=values=>[...new Set((values||[]).filter(Boolean))];
  const missing=value=>/^(无|没有|暂无|未填|未填写|未设置|未提供|不知道|不详|NA|N\/A|null|none)$/i.test(text(value));

  function normalizeItems(items){const map=new Map();(items||[]).forEach(item=>{const label=text(item?.label??item);if(!label||missing(label))return;const count=Math.max(1,Number(item?.count||1)||1);map.set(label,(map.get(label)||0)+count);});return[...map.entries()].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'zh-CN'));}
  function feedbackChips(items){const wrap=document.createElement('div');wrap.className='peer-feedback-chips';normalizeItems(items).forEach(({label,count})=>{const chip=document.createElement('span');chip.className='peer-feedback-chip';chip.textContent=count>1?`${label} ×${count}`:label;wrap.appendChild(chip);});return wrap;}
  function addFeedbackSection(parent,title,items){const normalized=normalizeItems(items);if(!normalized.length)return;const section=document.createElement('section');section.className='peer-feedback-section';const h=document.createElement('h4');h.textContent=title;section.append(h,feedbackChips(normalized));parent.appendChild(section);}
  function renderStructuredFeedback(){
    const card=document.getElementById('profile-card'),summary=state.profile?.peerReviewSummary;if(!card)return;
    card.querySelector('[data-profile-peer-review="1"]')?.remove();card.querySelector('.peer-review-summary')?.remove();card.querySelector('[data-peer-feedback="1"]')?.remove();
    if(!summary||!Number(summary.reviewCount||0))return;
    const block=document.createElement('div');block.className='profile-group profile-group-full peer-feedback-card';block.dataset.peerFeedback='1';
    const head=document.createElement('div');head.className='peer-feedback-head';const title=document.createElement('span');title.className='profile-label';title.textContent='客户反馈';const meta=document.createElement('span');meta.className='peer-feedback-meta';meta.textContent=`共 ${Number(summary.reviewCount)} 位客户反馈`;head.append(title,meta);block.appendChild(head);
    addFeedbackSection(block,'大家怎么称呼我',summary.topNicknames);addFeedbackSection(block,'他们和我的关系',summary.relationships||summary.topRelationships);addFeedbackSection(block,'他们眼中的我',summary.topTraits);addFeedbackSection(block,'他们愿意找我聊什么',summary.topTopics);addFeedbackSection(block,'他们觉得我更像哪种人',summary.topRoles);
    const quotes=uniq((summary.representativeQuotes||summary.quotes||[]).map(item=>text(item?.label??item))).filter(q=>q&&!missing(q));
    if(quotes.length){const section=document.createElement('section');section.className='peer-feedback-section peer-feedback-quotes';const h=document.createElement('h4');h.textContent='他们怎么向别人介绍我';section.appendChild(h);const list=document.createElement('div');list.className='peer-feedback-quote-list';quotes.forEach((quote,index)=>{const p=document.createElement('p');p.textContent=quote;if(index>=3)p.hidden=true;list.appendChild(p);});section.appendChild(list);if(quotes.length>3){const button=document.createElement('button');button.type='button';button.className='text-button peer-feedback-more';button.textContent=`查看全部 ${quotes.length} 条`;button.onclick=()=>{const expanded=button.dataset.expanded==='1';[...list.children].forEach((node,index)=>{if(index>=3)node.hidden=expanded;});button.dataset.expanded=expanded?'0':'1';button.textContent=expanded?`查看全部 ${quotes.length} 条`:'收起';};section.appendChild(button);}block.appendChild(section);}
    const intro=card.querySelector('[data-signup-intro="1"]');if(intro)card.insertBefore(block,intro);else card.appendChild(block);
  }

  function knownAddresses(profile){const items=[];const preferred=text(profile?.preferredName);if(preferred&&!missing(preferred))items.push(preferred);(profile?.peerReviewSummary?.topNicknames||[]).forEach(item=>{const label=text(item?.label);if(label&&!missing(label))items.push(label);});const name=text(profile?.name);if(name){items.push(name);if(name.length>=2)items.push(name.slice(1),name.slice(-1));}return uniq(items).filter(Boolean);}
  function evaluateNickname(name,profile){
    const value=text(name),issues=[],strengths=[];if(!value||missing(value))return{name:value,issues:['当前没有填写昵称'],strengths:[],hasPersonAnchor:false,missing:true};
    if(value.length<=10)strengths.push('长度比较利落，容易记');else if(value.length>14)issues.push('昵称偏长，不容易一次记住');
    if(/友邦|\bAIA\b/i.test(value))issues.push('包含品牌词，跨平台长期使用存在合规风险');
    if(/[©®™]|https?:\/\/|www\.|微信|vx|V信|电话|手机号/i.test(value))issues.push('包含联系方式、链接或导流信息');
    const matched=knownAddresses(profile).filter(address=>address&&value.includes(address));const distinct=uniq(matched.filter(a=>a.length>1));if(distinct.length>1)issues.push('一个昵称里出现了两个称呼主体，读起来像把两个名字拼在一起');
    const hasPersonAnchor=distinct.length===1||matched.length===1;if(hasPersonAnchor)strengths.push('有稳定的人物称呼，人物识别度较好');
    return{name:value,issues,strengths,hasPersonAnchor,missing:false};
  }
  function auditExistingNicknames(profile){window.aiaProfileRulesV27?.normalizeSignupProfile?.(profile);const rawVideo=text(profile?.videoNickname),rawXhs=text(profile?.xiaohongshuNickname);const video=missing(rawVideo)?'':rawVideo,xhs=missing(rawXhs)?'':rawXhs;const candidates=uniq([video,xhs]).filter(Boolean).map(name=>evaluateNickname(name,profile));const same=!!(video&&xhs&&video===xhs);const good=candidates.filter(item=>!item.issues.length&&item.hasPersonAnchor);return{video,xhs,same,candidates,preferred:good[0]?.name||''};}
  function nicknamePanelTarget(content){const heading=[...content.querySelectorAll('h2,h3,strong')].find(node=>/推荐昵称|昵称推荐/.test(text(node.textContent)));if(!heading)return null;return heading.closest('section,article,.proposal-section,.proposal-card,.proposal-block')||heading.parentElement;}
  function renderNicknameAuditInPlace(){
    const content=document.getElementById('proposal-content');if(!content)return;content.querySelector('.nickname-audit-card')?.remove();content.querySelector('.nickname-general-note')?.remove();const target=nicknamePanelTarget(content);if(!target)return;const audit=auditExistingNicknames(state.profile||{});
    if(audit.video||audit.xhs){const card=document.createElement('section');card.className='nickname-audit-card';const h=document.createElement('h3');h.textContent='现有昵称建议';card.appendChild(h);const current=document.createElement('p');current.className='nickname-audit-current';current.textContent=[audit.video&&`视频号：${audit.video}`,audit.xhs&&`小红书：${audit.xhs}`].filter(Boolean).join('　');card.appendChild(current);if(audit.video&&audit.xhs&&!audit.same){const p=document.createElement('p');p.textContent='两个平台现在用的昵称不一样。建议统一为同一个长期昵称，减少用户识别成本。';card.appendChild(p);}audit.candidates.forEach(item=>{const p=document.createElement('p');if(item.issues.length){p.textContent=`“${item.name}”暂不建议直接改掉，但有以下问题需要留意：${item.issues.map((x,i)=>`${i+1}. ${x}`).join(' ')}。如果这个昵称已经长期使用并有用户记忆，修改前应更谨慎。`;}else if(item.hasPersonAnchor){p.textContent=`“${item.name}”目前没有发现充分理由需要修改，建议优先保留，再把推荐昵称作为备选比较。`;}else{p.textContent=`“${item.name}”没有明显硬伤，但人物识别度一般。是否修改要结合已有用户记忆和这个名字对你的特殊意义。`;}card.appendChild(p);});target.parentNode.insertBefore(card,target);}
    const note=document.createElement('p');note.className='nickname-general-note';note.textContent='AI 推荐昵称仅供参考。标准化推荐不一定最能代表你；你最喜欢、最愿意长期使用、对你有特殊含义的名字，也可能就是最好的昵称。';const heading=[...target.querySelectorAll('h2,h3,strong')].find(node=>/推荐昵称|昵称推荐/.test(text(node.textContent)));(heading?.parentElement||target).appendChild(note);
  }

  const baseRenderProfile=renderProfile;renderProfile=function renderProfileV29(){const result=baseRenderProfile();requestAnimationFrame(renderStructuredFeedback);return result;};
  const baseRenderProposal=renderProposal;renderProposal=function renderProposalV29(proposal,version){const result=baseRenderProposal(proposal,version);requestAnimationFrame(()=>requestAnimationFrame(renderNicknameAuditInPlace));return result;};
  if(!document.getElementById('product-rules-v29-style')){const style=document.createElement('style');style.id='product-rules-v29-style';style.textContent='.nickname-general-note{margin:10px 0 0;padding:10px 12px;border-radius:10px;background:#f7f4f5;color:#6a5f63;font-size:13px;line-height:1.6}.peer-feedback-card{grid-column:1/-1!important}';document.head.appendChild(style);}
  window.aiaProductRulesV29=Object.freeze({renderStructuredFeedback,evaluateNickname,auditExistingNicknames,renderNicknameAuditInPlace,ownsNicknameOptions:false});
})();
