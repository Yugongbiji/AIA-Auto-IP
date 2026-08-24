// 产品规则 V22（公共 UI 工具层）：只提供 Toast 与小红书 loading 文案标准化。
// 创作结果“真实复制成功/失败”的唯一 owner 是 product-rules-v28.js；本文件不得包 Clipboard API 或监听按钮文字推断复制成功。
(function () {
  'use strict';
  const XHS_LOADING_TEXT = '正在排版，请稍候…';

  function ensureToastHost() {
    let host = document.getElementById('aia-toast-host');
    if (host) return host;
    host = document.createElement('div');
    host.id = 'aia-toast-host';
    host.className = 'aia-toast-host';
    host.setAttribute('aria-live', 'polite');
    host.setAttribute('aria-atomic', 'true');
    document.body.appendChild(host);
    return host;
  }

  function showToast(message, type = 'success') {
    const host = ensureToastHost();
    const toast = document.createElement('div');
    toast.className = `aia-toast aia-toast-${type}`;
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    host.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 180);
    }, 1600);
  }

  function normalizeXhsLoading(root = document.getElementById('xhs-messages')) {
    if (!root) return;
    root.querySelectorAll('.message, [role="status"], p, span, div').forEach((node) => {
      if (node.children.length) return;
      const value = String(node.textContent || '').trim();
      if (!value) return;
      if (/正在整理手机阅读节奏|正在.*手机.*阅读|正在.*断句|正在.*留白|正在.*表情/.test(value)) node.textContent = XHS_LOADING_TEXT;
    });
  }

  const xhsMessages = document.getElementById('xhs-messages');
  if (xhsMessages) {
    new MutationObserver(() => queueMicrotask(() => normalizeXhsLoading(xhsMessages)))
      .observe(xhsMessages, { childList: true, subtree: true, characterData: true });
    normalizeXhsLoading(xhsMessages);
  }

  if (!document.getElementById('aia-toast-style')) {
    const style = document.createElement('style');
    style.id = 'aia-toast-style';
    style.textContent = `
      .aia-toast-host{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none}
      .aia-toast{max-width:min(82vw,320px);padding:10px 16px;border-radius:10px;background:#2f2f33;color:#fff;font-size:14px;font-weight:700;box-shadow:0 8px 24px #0002;opacity:0;transform:translateY(8px);transition:opacity .18s ease,transform .18s ease}
      .aia-toast.show{opacity:1;transform:translateY(0)}
      .aia-toast-error{background:#8f233e}
      @media(max-width:640px){.aia-toast-host{bottom:calc(18px + var(--aia-keyboard-inset,0px))}}
    `;
    document.head.appendChild(style);
  }

  window.aiaToast = showToast;
  window.normalizeXhsLoadingV22 = normalizeXhsLoading;
  window.aiaUiUtilityV22 = Object.freeze({ ownsClipboard:false, ownsBusinessRules:false });
})();
