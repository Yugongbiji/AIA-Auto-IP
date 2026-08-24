// 产品规则 V17：脚本详情支持上一篇 / 下一篇，按当前推荐或脚本库列表顺序浏览。
(function () {
  const originalFetch = window.fetch.bind(window);
  let browseItems = [];
  let currentIndex = -1;

  function requestUrl(input) { return typeof input === 'string' ? input : input?.url || ''; }
  function isScriptRecommendUrl(input) { return /\/api\/scripts\/recommend(?:\?|$)/.test(requestUrl(input)); }
  function isScriptLibraryUrl(input) { return /\/api\/scripts\/library(?:\?|$)/.test(requestUrl(input)); }
  function isScriptDetailUrl(input) { return /\/api\/scripts\/\d+(?:\?|$)/.test(requestUrl(input)); }
  function extractScriptId(input) {
    const match = requestUrl(input).match(/\/api\/scripts\/(\d+)(?:\?|$)/);
    return match ? Number(match[1]) : null;
  }

  function setBrowseItems(items, directionGetter) {
    const seen = new Set();
    browseItems = [];
    (items || []).forEach((script) => {
      const id = Number(script?.script_id);
      if (!id || seen.has(id)) return;
      seen.add(id);
      browseItems.push({ id, direction: directionGetter(script) || '' });
    });
  }

  window.fetch = async function fetchWithScriptBrowse(input, init) {
    const response = await originalFetch(input, init);
    try {
      if (isScriptRecommendUrl(input) && response.ok) {
        const payload = await response.clone().json();
        const flat = [];
        (payload.groups || []).forEach((group) => (group.scripts || []).forEach((script) => flat.push({ ...script, _direction: group.content_direction || '' })));
        setBrowseItems(flat, (script) => script._direction);
      } else if (isScriptLibraryUrl(input) && response.ok) {
        const payload = await response.clone().json();
        setBrowseItems(payload.scripts || [], () => '脚本库');
      } else if (isScriptDetailUrl(input) && response.ok) {
        const id = extractScriptId(input);
        currentIndex = browseItems.findIndex((item) => item.id === id);
        queueMicrotask(syncButtons);
      }
    } catch (_) {}
    return response;
  };

  function ensureButtons() {
    const content = document.querySelector('.script-detail-content');
    if (!content) return null;
    let nav = content.querySelector('.script-detail-page-nav');
    if (nav) return nav;

    nav = document.createElement('nav');
    nav.className = 'script-detail-page-nav';
    nav.setAttribute('aria-label', '文章浏览');

    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'script-page-link script-page-previous';
    previous.dataset.scriptPage = 'previous';
    previous.innerHTML = '<span class="script-page-label">上一篇</span><span class="script-page-arrow">←</span>';

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'script-page-link script-page-next';
    next.dataset.scriptPage = 'next';
    next.innerHTML = '<span class="script-page-label">下一篇</span><span class="script-page-arrow">→</span>';

    previous.addEventListener('click', () => openRelative(-1));
    next.addEventListener('click', () => openRelative(1));
    nav.append(previous, next);
    content.appendChild(nav);

    if (!document.getElementById('script-detail-page-nav-style')) {
      const style = document.createElement('style');
      style.id = 'script-detail-page-nav-style';
      style.textContent = `.script-detail-page-nav{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:34px 0 8px;padding-top:22px;border-top:1px solid #eee8ea}.script-page-link{min-height:64px;padding:12px 16px;border:1px solid #e8e0e3;border-radius:14px;background:#fff;color:#332b2e;cursor:pointer;display:flex;align-items:center;gap:10px;font:inherit}.script-page-link:hover{border-color:#d8bcc5;background:#fffafb}.script-page-previous{justify-content:flex-start;text-align:left}.script-page-next{justify-content:flex-end;text-align:right}.script-page-label{font-weight:800}.script-page-arrow{font-size:18px;color:#d31145}.script-page-link:disabled{opacity:.38;cursor:not-allowed;background:#faf8f9}.script-page-link:focus-visible{outline:3px solid #d3114540;outline-offset:2px}@media(max-width:640px){.script-detail-page-nav{gap:10px;margin-top:26px}.script-page-link{min-height:56px;padding:10px 12px;border-radius:12px}}`;
      document.head.appendChild(style);
    }
    return nav;
  }

  function syncButtons() {
    const nav = ensureButtons(); if (!nav) return;
    const previous = nav.querySelector('[data-script-page="previous"]');
    const next = nav.querySelector('[data-script-page="next"]');
    const hasCurrent = currentIndex >= 0 && currentIndex < browseItems.length;
    previous.disabled = !hasCurrent || currentIndex === 0;
    next.disabled = !hasCurrent || currentIndex === browseItems.length - 1;
  }

  function openRelative(step) {
    const targetIndex = currentIndex + step;
    const target = browseItems[targetIndex];
    if (!target || !window.scriptRecommendationV1?.openDetail) return;
    currentIndex = targetIndex;
    window.scriptRecommendationV1.openDetail(target.id, target.direction);
  }

  const observer = new MutationObserver(() => {
    const screen = document.getElementById('script-detail-screen');
    if (screen && !screen.classList.contains('hidden')) syncButtons();
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  ensureButtons();
  syncButtons();
})();
