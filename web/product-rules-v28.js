// 产品规则 V28：创作结果复制反馈必须由真实复制动作直接触发，不再依赖外围观察器兜底。
(function () {
  async function writeClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(String(text || ''));
      return true;
    }
    const textarea = document.createElement('textarea');
    textarea.value = String(text || '');
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    let ok = false;
    try { ok = document.execCommand('copy'); }
    finally { textarea.remove(); }
    if (!ok) throw new Error('copy failed');
    return true;
  }

  function show(message, type = 'success') {
    if (typeof window.aiaToast === 'function') window.aiaToast(message, type);
  }

  // Capture before the legacy inline onclick. This makes the actual creative copy button
  // own its success/failure contract and prevents duplicate/indirect handlers from racing.
  document.addEventListener('click', async (event) => {
    const button = event.target?.closest?.('.creative-copy-block .copy-button');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const block = button.closest('.creative-copy-block');
    const textarea = block?.querySelector('.creative-textarea');
    const value = textarea?.value || '';
    const original = button.textContent;
    button.disabled = true;
    try {
      await writeClipboard(value);
      button.textContent = '复制成功';
      show('复制成功');
    } catch (_) {
      button.textContent = '复制失败';
      show('复制失败，请重试', 'error');
    } finally {
      setTimeout(() => { button.textContent = original || '复制全文'; button.disabled = false; }, 1300);
    }
  }, true);

  window.aiaCreativeCopyV28 = { writeClipboard };
})();
