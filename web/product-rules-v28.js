// 公共 Clipboard Owner：昵称、简介、脚本改写、小红书排版统一使用真实复制结果反馈。
(function () {
  'use strict';
  async function writeClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(String(text || ''));
      return true;
    }
    const textarea = document.createElement('textarea');
    textarea.value = String(text || '');
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed'; textarea.style.opacity = '0'; textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea); textarea.select();
    let ok = false;
    try { ok = document.execCommand('copy'); }
    finally { textarea.remove(); }
    if (!ok) throw new Error('copy failed');
    return true;
  }
  function show(message, type = 'success') { if (typeof window.aiaToast === 'function') window.aiaToast(message, type); }
  async function copyWithFeedback(text, button, successLabel='复制成功') {
    const original=button?.textContent||''; if(button)button.disabled=true;
    try { await writeClipboard(text); if(button)button.textContent=successLabel; show(successLabel); return true; }
    catch (_) { if(button)button.textContent='复制失败'; show('复制失败，请重试','error'); return false; }
    finally { if(button)setTimeout(()=>{button.textContent=original||'复制全文';button.disabled=false;},1300); }
  }

  // 接管 app.js 的通用 copyText 入口，避免昵称/简介继续走旧 Clipboard 实现。
  if (typeof copyText === 'function') copyText = (text, button) => copyWithFeedback(text, button);

  // 创作结果复制：capture 阶段阻止旧 inline handler 重复执行。
  document.addEventListener('click', async (event) => {
    const button = event.target?.closest?.('.creative-copy-block .copy-button');
    if (!button) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const block = button.closest('.creative-copy-block');
    const textarea = block?.querySelector('.creative-textarea');
    await copyWithFeedback(textarea?.value || '', button);
  }, true);

  window.aiaClipboard=Object.freeze({writeClipboard,copyWithFeedback});
  window.aiaCreativeCopyV28=window.aiaClipboard;
})();
