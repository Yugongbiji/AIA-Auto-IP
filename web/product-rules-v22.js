// 公共 UI 工具：Toast + 创作 Loading 文案统一入口。
// 不再通过 MutationObserver 事后篡改 DOM；消息进入 addCreativeMessage 前完成规范化。
(function () {
  'use strict';
  const STATUS=Object.freeze({script:'正在改写，请稍候…',xhs:'正在排版，请稍候…'});

  function ensureToastHost() {
    let host = document.getElementById('aia-toast-host');
    if (host) return host;
    host = document.createElement('div'); host.id = 'aia-toast-host'; host.className = 'aia-toast-host';
    host.setAttribute('aria-live', 'polite'); host.setAttribute('aria-atomic', 'true'); document.body.appendChild(host); return host;
  }
  function showToast(message, type = 'success') {
    const host = ensureToastHost(); const toast = document.createElement('div'); toast.className = `aia-toast aia-toast-${type}`;
    toast.setAttribute('role', 'status'); toast.textContent = message; host.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 180); }, 1600);
  }
  function loadingText(tool){return STATUS[tool]||'正在处理，请稍候…';}
  function normalizeCreativeText(tool,value){
    const text=String(value||'').trim(); if(!text)return value;
    if(tool==='xhs'&&/正在.*(?:排版|手机.*阅读|断句|留白|表情|整理)/.test(text))return STATUS.xhs;
    if(tool==='script'&&/正在.*(?:改写|保留原文|检查合规|整理.*改写稿|生成.*改写)/.test(text))return STATUS.script;
    return value;
  }

  if(typeof addCreativeMessage==='function'){
    const base=addCreativeMessage;
    addCreativeMessage=function aiaCreativeMessage(tool,text,...rest){return base(tool,normalizeCreativeText(tool,text),...rest);};
  }
  function normalizeXhsLoading(root = document.getElementById('xhs-messages')) {
    if (!root) return;
    root.querySelectorAll('.message, [role="status"], p, span, div').forEach((node) => {
      if (node.children.length) return; const value = String(node.textContent || '').trim();
      if (value && /正在.*(?:排版|手机.*阅读|断句|留白|表情|整理)/.test(value)) node.textContent = STATUS.xhs;
    });
  }

  if (!document.getElementById('aia-toast-style')) {
    const style = document.createElement('style'); style.id = 'aia-toast-style'; style.textContent = `
      .aia-toast-host{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none}
      .aia-toast{max-width:min(82vw,320px);padding:10px 16px;border-radius:10px;background:#2f2f33;color:#fff;font-size:14px;font-weight:700;box-shadow:0 8px 24px #0002;opacity:0;transform:translateY(8px);transition:opacity .18s ease,transform .18s ease}
      .aia-toast.show{opacity:1;transform:translateY(0)}.aia-toast-error{background:#8f233e}
      @media(max-width:640px){.aia-toast-host{bottom:calc(18px + var(--aia-keyboard-inset,0px))}}
    `; document.head.appendChild(style);
  }

  window.aiaToast = showToast;
  window.normalizeXhsLoadingV22 = normalizeXhsLoading;
  window.aiaCreativeStatus=Object.freeze({loadingText,normalizeCreativeText});
  window.aiaUiUtilityV22 = Object.freeze({ ownsClipboard:false, ownsBusinessRules:false, ownsCreativeStatus:true });
})();
