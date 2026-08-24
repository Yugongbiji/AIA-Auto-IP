// IP 人设悬浮入口：纯图标“我的资料” + “IP方案”。
// 唯一职责：显示/隐藏、展开/收起、拖动、打开最新方案；不再重写资料内容或业务数据。
(function () {
  'use strict';
  const panel = document.querySelector('.profile-panel');
  if (!panel) return;

  panel.classList.add('profile-floating-detail');
  panel.setAttribute('aria-expanded', 'false');

  const actions = document.createElement('div');
  actions.className = 'ip-floating-actions';
  actions.setAttribute('aria-label', 'IP 快捷入口');

  const profileButton = document.createElement('button');
  profileButton.type = 'button';
  profileButton.className = 'ip-floating-button ip-floating-profile-button';
  profileButton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 19c.7-4 3-6 6.5-6s5.8 2 6.5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  profileButton.setAttribute('aria-label', '我的资料');
  profileButton.setAttribute('title', '我的资料');
  profileButton.setAttribute('aria-expanded', 'false');

  const proposalButton = document.createElement('button');
  proposalButton.type = 'button';
  proposalButton.className = 'ip-floating-button ip-floating-proposal-button hidden';
  proposalButton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><path d="M12 3l1.5 4.2L18 9l-4.5 1.8L12 15l-1.5-4.2L6 9l4.5-1.8L12 3Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
  proposalButton.setAttribute('aria-label', 'IP方案');
  proposalButton.setAttribute('title', 'IP方案');

  actions.append(profileButton, proposalButton);
  document.body.appendChild(actions);

  function overlayOpen() {
    return ['proposal-screen', 'content-plan-screen', 'script-detail-screen'].some((id) => {
      const node=document.getElementById(id); return node && !node.classList.contains('hidden');
    });
  }
  function workspaceReady() {
    const workspace=document.getElementById('workspace'), identity=document.getElementById('identity-screen');
    return !!workspace && !workspace.classList.contains('hidden') && (!identity || identity.classList.contains('hidden'));
  }
  function isIpConversationVisible() {
    const chat=document.getElementById('ip-chat-panel');
    return workspaceReady() && state.activeTool==='ip' && chat && !chat.classList.contains('hidden') && !overlayOpen();
  }
  function closeProfileDetail() {
    panel.classList.remove('profile-floating-detail-open'); panel.setAttribute('aria-expanded','false'); profileButton.setAttribute('aria-expanded','false');
  }
  function ensureCloseButton() {
    const title=panel.querySelector('.profile-title'); if(!title||title.querySelector('.profile-floating-close'))return;
    const close=document.createElement('button'); close.type='button'; close.className='profile-floating-close'; close.setAttribute('aria-label','关闭我的资料'); close.title='关闭'; close.textContent='×'; close.addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();closeProfileDetail();}); title.appendChild(close);
  }
  function toggleProfileDetail() {
    const next=!panel.classList.contains('profile-floating-detail-open'); panel.classList.toggle('profile-floating-detail-open',next); panel.setAttribute('aria-expanded',next?'true':'false'); profileButton.setAttribute('aria-expanded',next?'true':'false'); if(next){ensureCloseButton();panel.scrollTop=0;}
  }
  function syncProposalButton() {
    const latest=state.proposals?.[0]; proposalButton.classList.toggle('hidden',!latest);
  }
  function syncVisibility() {
    const visible=isIpConversationVisible(); actions.classList.toggle('hidden',!visible); if(!visible)closeProfileDetail(); syncProposalButton();
  }

  profileButton.addEventListener('click',(event)=>{if(actions.dataset.dragged==='1')return;event.preventDefault();event.stopPropagation();toggleProfileDetail();});
  proposalButton.addEventListener('click',(event)=>{if(actions.dataset.dragged==='1')return;event.preventDefault();const latest=state.proposals?.[0];if(latest){closeProfileDetail();renderProposal(latest.proposal,latest.version);queueMicrotask(syncVisibility);}});
  document.addEventListener('click',(event)=>{if(!panel.classList.contains('profile-floating-detail-open'))return;if(panel.contains(event.target)||actions.contains(event.target))return;closeProfileDetail();});

  function ensureConversationHint() {
    if (panel.querySelector('.profile-conversation-hint')) return;
    const hint=document.createElement('p'); hint.className='profile-conversation-hint'; hint.textContent='💬 想修改资料，直接在 IP 对话框里告诉我即可。'; document.getElementById('profile-card')?.insertAdjacentElement('afterend',hint);
  }
  ensureConversationHint(); ensureCloseButton(); syncVisibility();

  // 只在既有渲染完成后同步 UI，不拥有资料渲染。
  if (typeof renderProfile==='function') { const base=renderProfile; renderProfile=function floatingUiRenderProfile(){const result=base.apply(this,arguments);ensureConversationHint();ensureCloseButton();syncVisibility();return result;}; }
  if (typeof selectTool==='function') { const base=selectTool; selectTool=function floatingUiSelectTool(tool){const result=base(tool);syncVisibility();return result;}; }
  if (typeof refreshProposalButton==='function') { const base=refreshProposalButton; refreshProposalButton=function floatingUiRefreshProposalButton(){const result=base.apply(this,arguments);syncProposalButton();return result;}; }

  let drag=null;
  actions.addEventListener('pointerdown',(event)=>{if(event.button!==0)return;const rect=actions.getBoundingClientRect();drag={startX:event.clientX,startY:event.clientY,left:rect.left,top:rect.top,moved:false};});
  actions.addEventListener('pointermove',(event)=>{if(!drag)return;const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;if(Math.hypot(dx,dy)<14&&!drag.moved)return;drag.moved=true;event.preventDefault();const maxLeft=Math.max(8,window.innerWidth-actions.offsetWidth-8),maxTop=Math.max(8,window.innerHeight-actions.offsetHeight-8);actions.style.left=`${Math.min(maxLeft,Math.max(8,drag.left+dx))}px`;actions.style.top=`${Math.min(maxTop,Math.max(8,drag.top+dy))}px`;actions.style.right='auto';actions.style.bottom='auto';});
  function endDrag(){if(!drag)return;if(drag.moved){actions.dataset.dragged='1';setTimeout(()=>{actions.dataset.dragged='0';},120);try{localStorage.setItem('aia-ip-floating-position',JSON.stringify({left:actions.style.left,top:actions.style.top}));}catch(_){}}drag=null;}
  actions.addEventListener('pointerup',endDrag);actions.addEventListener('pointercancel',endDrag);
  try{const saved=JSON.parse(localStorage.getItem('aia-ip-floating-position')||'null');if(saved?.left&&saved?.top){actions.style.left=saved.left;actions.style.top=saved.top;actions.style.right='auto';actions.style.bottom='auto';}}catch(_){}

  // 79：禁止观察整个 document.body 子树。只监听真正决定悬浮入口可见性的少量容器，
  // 避免 loading / 消息渲染 / Toast 等任意 class 变化把同步逻辑放大成高频反馈链。
  const visibilityNodes = ['workspace','identity-screen','ip-chat-panel','proposal-screen','content-plan-screen','script-detail-screen']
    .map((id)=>document.getElementById(id)).filter(Boolean);
  const visibilityObserver = new MutationObserver(()=>queueMicrotask(syncVisibility));
  visibilityNodes.forEach((node)=>visibilityObserver.observe(node,{attributes:true,attributeFilter:['class']}));

  window.aiaFloatingUi=Object.freeze({syncVisibility,closeProfileDetail,ownsProfileData:false});
})();
