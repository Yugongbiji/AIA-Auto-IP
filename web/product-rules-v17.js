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
    const footer = document.querySelector('.script-detail-actions');
    if (!footer) return null;
    let nav = footer.querySelector('.script-detail-page-nav');
    if (nav) return nav;
    nav = document.createElement('div'); nav.className = 'script-detail-page-nav';
    const previous = document.createElement('button'); previous.type = 'button'; previous.className = 'secondary-button'; previous.dataset.scriptPage = 'previous'; previous.textContent = '← 上一篇';
    const next = document.createElement('button'); next.type = 'button'; next.className = 'secondary-button'; next.dataset.scriptPage = 'next'; next.textContent = '下一篇 →';
    previous.addEventListener('click', () => openRelative(-1)); next.addEventListener('click', () => openRelative(1)); nav.append(previous, next); footer.prepend(nav);
    if (!document.getElementById('script-detail-page-nav-style')) {
      const style = document.createElement('style'); style.id = 'script-detail-page-nav-style'; style.textContent = `.script-detail-page-nav{display:flex;gap:10px;margin-right:auto}.script-detail-page-nav button{min-width:110px}.script-detail-page-nav button:disabled{opacity:.42;cursor:not-allowed}@media(max-width:640px){.script-detail-actions{flex-wrap:wrap}.script-detail-page-nav{order:-1;width:100%;margin:0;display:grid;grid-template-columns:1fr 1fr}.script-detail-page-nav button{width:100%;min-width:0}}`; document.head.appendChild(style);
    }
    return nav;
  }
  function syncButtons() {
    const nav = ensureButtons(); if (!nav) return;
    const previous = nav.querySelector('[data-script-page="previous"]'); const next = nav.querySelector('[data-script-page="next"]');
    const hasCurrent = currentIndex >= 0 && currentIndex < browseItems.length;
    previous.disabled = !hasCurrent || currentIndex === 0; next.disabled = !hasCurrent || currentIndex === browseItems.length - 1;
  }
  function openRelative(step) {
    const targetIndex = currentIndex + step; const target = browseItems[targetIndex];
    if (!target || !window.scriptRecommendationV1?.openDetail) return;
    currentIndex = targetIndex; window.scriptRecommendationV1.openDetail(target.id, target.direction);
  }
  const observer = new MutationObserver(() => {
    const screen = document.getElementById('script-detail-screen');
    if (screen && !screen.classList.contains('hidden')) syncButtons();
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  ensureButtons(); syncButtons();
})();
