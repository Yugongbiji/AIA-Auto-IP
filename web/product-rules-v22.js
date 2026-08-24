// 产品规则 V22：统一创作工具的 loading 文案与复制成功反馈，避免单功能重复造交互。
(function () {
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

  // 统一包住 Clipboard API：昵称、简介、脚本、小红书等所有复制成功都走同一个反馈组件。
  if (navigator.clipboard?.writeText && !navigator.clipboard.writeText.__aiaWrapped) {
    const nativeWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
    const wrapped = async function aiaWriteText(text) {
      try {
        const result = await nativeWriteText(text);
        showToast('复制成功');
        return result;
      } catch (error) {
        showToast('复制失败，请重试', 'error');
        throw error;
      }
    };
    wrapped.__aiaWrapped = true;
    try { navigator.clipboard.writeText = wrapped; } catch (_) { /* 某些浏览器禁止重写，下面保留按钮兜底 */ }
  }

  // 对成熟的“复制”按钮做通用兜底：如果底层没有走 Clipboard API，也给用户明确成功/失败反馈。
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('button');
    if (!button || !/复制/.test(button.textContent || '')) return;
    button.dataset.aiaCopyPending = String(Date.now());
    const original = button.textContent;
    setTimeout(() => {
      if (!button.isConnected) return;
      // 原业务若已将按钮改成“已复制/复制成功”，不重复 toast；否则给统一轻提示。
      if (/已复制|复制成功/.test(button.textContent || '')) return;
      if (button.dataset.aiaCopyPending) showToast('复制成功');
      if (button.textContent === original) {
        button.textContent = '已复制';
        setTimeout(() => { if (button.isConnected && button.textContent === '已复制') button.textContent = original; }, 1200);
      }
    }, 80);
  }, true);

  // 小红书等待态只表达“正在排版”，不再重复解释手机阅读节奏、断句等内部处理逻辑。
  function normalizeXhsLoading(root = document.getElementById('xhs-messages')) {
    if (!root) return;
    root.querySelectorAll('.message, [role="status"], p, span, div').forEach((node) => {
      if (node.children.length) return;
      const text = String(node.textContent || '').trim();
      if (!text) return;
      if (/正在整理手机阅读节奏|正在.*手机.*阅读|正在.*断句|正在.*留白|正在.*表情/.test(text)) {
        node.textContent = XHS_LOADING_TEXT;
      }
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
})();
