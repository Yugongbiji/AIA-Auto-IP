// 产品规则 V21：每个推荐板块独立“换一批”；详情清理内部结构标签；展示今日推荐日期。
(function () {
  const PAGE_SIZE = 5;
  const offsets = new WeakMap();
  let cleaningDetail = false;

  function formatToday() {
    const now = new Date();
    return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  }

  function ensureTodayBadge() {
    const head = document.querySelector('.script-recommendation-head');
    if (!head) return;
    let badge = head.querySelector('.script-today-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'script-today-badge';
      head.appendChild(badge);
    }
    badge.textContent = `${formatToday()} · 今日推荐`;
  }

  function cardsIn(section) {
    return [...section.querySelectorAll('.script-card-list .script-recommendation-card')];
  }

  function applyPage(section) {
    const cards = cardsIn(section);
    if (!cards.length) return;
    let offset = offsets.get(section) || 0;
    if (offset >= cards.length) offset = 0;
    offsets.set(section, offset);
    cards.forEach((card, index) => {
      const inWindow = index >= offset && index < offset + PAGE_SIZE;
      card.hidden = !inWindow;
    });
    const button = section.querySelector('.script-section-refresh');
    if (button) {
      button.disabled = cards.length <= PAGE_SIZE;
      button.title = cards.length <= PAGE_SIZE ? '当前可匹配脚本不足两批' : '换一批推荐';
    }
  }

  function ensureSectionRefresh(section) {
    const heading = section.querySelector('.script-direction-heading');
    if (!heading || heading.querySelector('.script-section-refresh')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-button script-section-refresh';
    button.textContent = '换一批';
    button.addEventListener('click', () => {
      const cards = cardsIn(section);
      if (cards.length <= PAGE_SIZE) return;
      const current = offsets.get(section) || 0;
      const next = current + PAGE_SIZE >= cards.length ? 0 : current + PAGE_SIZE;
      offsets.set(section, next);
      applyPage(section);
    });
    heading.appendChild(button);
  }

  function enhanceRecommendationPage() {
    ensureTodayBadge();
    document.querySelectorAll('.script-direction-section').forEach((section) => {
      ensureSectionRefresh(section);
      applyPage(section);
    });
  }

  function cleanStructureMarkers(text) {
    return String(text || '')
      .split(/\n/)
      .map((line) => line.replace(/^\s*(?:开头|正文\s*\d*|脚本正文\s*\d*|文案正文\s*\d*|结尾|结语|结束语)\s*[：:]?\s*/i, ''))
      .filter((line, index, arr) => line.trim() || (index > 0 && index < arr.length - 1))
      .join('\n')
      .replace(/^(?:开头|正文\s*\d*|脚本正文\s*\d*|文案正文\s*\d*|结尾|结语|结束语)\s*[：:]?\s*/i, '')
      .trim();
  }

  function cleanDetailBody() {
    const body = document.getElementById('script-detail-body');
    if (!body || cleaningDetail) return;
    const current = body.textContent || '';
    const cleaned = cleanStructureMarkers(current);
    if (cleaned !== current) {
      cleaningDetail = true;
      body.textContent = cleaned;
      cleaningDetail = false;
    }
  }

  if (!document.getElementById('script-recommendation-v21-style')) {
    const style = document.createElement('style');
    style.id = 'script-recommendation-v21-style';
    style.textContent = `
      .script-recommendation-head{position:relative}
      .script-today-badge{margin-left:auto;align-self:flex-start;white-space:nowrap;padding:7px 11px;border-radius:999px;background:#f7f2f4;color:#6d6267;font-size:13px;font-weight:700}
      .script-direction-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
      .script-section-refresh{flex:0 0 auto;padding:7px 13px}
      .script-recommendation-card[hidden]{display:none!important}
      @media(max-width:640px){.script-today-badge{position:absolute;right:0;top:0;font-size:12px}.script-direction-heading{gap:8px}.script-section-refresh{padding:6px 10px}}
    `;
    document.head.appendChild(style);
  }

  const recommendationRoot = document.getElementById('script-recommendation-body');
  if (recommendationRoot) {
    new MutationObserver(() => queueMicrotask(enhanceRecommendationPage)).observe(recommendationRoot, { childList: true, subtree: true });
  }
  const detailBody = document.getElementById('script-detail-body');
  if (detailBody) {
    new MutationObserver(() => queueMicrotask(cleanDetailBody)).observe(detailBody, { childList: true, subtree: true, characterData: true });
  }

  enhanceRecommendationPage();
  cleanDetailBody();
})();
