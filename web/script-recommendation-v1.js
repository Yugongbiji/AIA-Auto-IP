// 脚本推荐 V3：有 IP 时按保险主线 / 内容支线推荐；无 IP 时按二级标签浏览脚本库。
(function () {
  const recommendationState = { loaded: false, loading: false, batch: '', groups: [], detail: null, direction: '', library: null, libraryTag: '', libraryPage: 1 };
  document.getElementById('script-recommendation-refresh')?.remove();

  function latestProposal() { return state.proposals?.[0]?.proposal || null; }
  function hasIpPlan() { return Boolean(latestProposal()); }
  function scriptApiUrl(path) {
    const normalized = String(path || '').replace(/^\/+/, '');
    const preview = window.location.pathname === '/preview' || window.location.pathname.startsWith('/preview/');
    return `${preview ? '/preview' : ''}/api/scripts/${normalized}`;
  }
  function currentStrategy() {
    if (typeof window.buildIpContentStrategy !== 'function') return { lines: [] };
    return window.buildIpContentStrategy(state.profile || {}, latestProposal() || {}) || { lines: [] };
  }
  function currentDirections() { return [...new Set((currentStrategy().lines || []).flatMap((line) => line.directions || []).filter(Boolean))]; }
  function sectionDefinitions() {
    const lines = currentStrategy().lines || [];
    const insurance = lines.find((line) => line.kind === 'acquisition' || line.kind === 'recruitment');
    const branch = lines.find((line) => line.kind === 'general');
    return [
      { key: 'insurance', title: '保险主线', subtitle: insurance?.kind === 'recruitment' ? '围绕增员主线推荐' : '围绕拓客主线推荐', directions: insurance?.directions || [] },
      { key: 'branch', title: '内容支线', subtitle: branch?.source ? `来源：${branch.source}` : '来自你的真实职业、身份或爱好', directions: branch?.directions || [] },
    ];
  }
  function metaText(script) {
    const tags = [script.level1_tag, script.level2_tag].filter(Boolean);
    return [...tags, `${script.word_count || 0}字`, `${Number(script.estimated_minutes || 0).toFixed(1)}min`].join(' · ');
  }
  async function track(scriptId, eventType, contentDirection) {
    try {
      await fetch(scriptApiUrl('activity'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scriptId, eventType, agentId: state.profile?.agentId || '', contentDirection: contentDirection || '', recommendationBatch: recommendationState.batch || '' }) });
    } catch (_) {}
  }
  function scriptsForDirections(directions) {
    const wanted = new Set(directions || []), result = [], seen = new Set();
    recommendationState.groups.forEach((group) => {
      if (!wanted.has(group.content_direction)) return;
      (group.scripts || []).forEach((script) => {
        if (!script?.script_id || seen.has(script.script_id)) return;
        seen.add(script.script_id); result.push({ ...script, _direction: group.content_direction });
      });
    });
    return result;
  }
  function renderScriptCard(script, list) {
    const card = document.createElement('article'); card.className = 'script-recommendation-card';
    const row = document.createElement('div'); row.className = 'script-card-title-row';
    if (script.is_hot) { const hot = document.createElement('span'); hot.className = 'script-hot-badge'; hot.textContent = '热点'; row.appendChild(hot); }
    const title = document.createElement('button'); title.type = 'button'; title.className = 'script-card-title'; title.textContent = script.title || '未命名脚本';
    title.addEventListener('click', () => openDetail(script.script_id, script._direction || '脚本库'));
    const meta = document.createElement('p'); meta.className = 'script-card-meta'; meta.textContent = metaText(script);
    row.appendChild(title); card.append(row, meta); list.appendChild(card); track(script.script_id, 'impression', script._direction || '脚本库');
  }
  function addIpPrompt(root) {
    const prompt = document.createElement('section'); prompt.className = 'script-library-ip-prompt';
    prompt.innerHTML = '<div><strong>完成 IP 人设，推荐会更懂你</strong><p>现在可以先浏览全部脚本。完成 IP 方案后，会根据你的保险主线、内容支线和个人特点优先推荐。</p></div>';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'primary'; button.textContent = '去完善我的 IP'; button.addEventListener('click', () => selectTool('ip'));
    prompt.appendChild(button); root.appendChild(prompt);
  }
  function renderLibrary() {
    const root = document.getElementById('script-recommendation-body'); if (!root) return; root.innerHTML = '';
    addIpPrompt(root);
    if (recommendationState.loading || !recommendationState.library) { root.insertAdjacentHTML('beforeend', '<div class="script-recommendation-loading">正在加载脚本库…</div>'); return; }
    const data = recommendationState.library;
    const nav = document.createElement('div'); nav.className = 'script-library-tags';
    ['全部', ...(data.tags || [])].forEach((tag) => {
      const value = tag === '全部' ? '' : tag; const button = document.createElement('button'); button.type = 'button'; button.className = `script-library-tag ${recommendationState.libraryTag === value ? 'active' : ''}`; button.textContent = tag;
      button.addEventListener('click', () => { recommendationState.libraryTag = value; recommendationState.libraryPage = 1; loadLibrary(true); }); nav.appendChild(button);
    }); root.appendChild(nav);
    const list = document.createElement('div'); list.className = 'script-card-list script-library-grid'; (data.scripts || []).forEach((script) => renderScriptCard(script, list));
    if (!data.scripts?.length) list.innerHTML = '<p class="script-recommendation-empty">这个分类暂时没有脚本。</p>'; root.appendChild(list);
    if ((data.pages || 1) > 1) {
      const pager = document.createElement('div'); pager.className = 'script-library-pager';
      const prev = document.createElement('button'); prev.type = 'button'; prev.className = 'secondary-button'; prev.textContent = '上一页'; prev.disabled = data.page <= 1;
      const info = document.createElement('span'); info.textContent = `${data.page} / ${data.pages}`;
      const next = document.createElement('button'); next.type = 'button'; next.className = 'secondary-button'; next.textContent = '下一页'; next.disabled = data.page >= data.pages;
      prev.addEventListener('click', () => { recommendationState.libraryPage -= 1; loadLibrary(true); }); next.addEventListener('click', () => { recommendationState.libraryPage += 1; loadLibrary(true); });
      pager.append(prev, info, next); root.appendChild(pager);
    }
  }
  function renderRecommendations() {
    if (!hasIpPlan()) return renderLibrary();
    const root = document.getElementById('script-recommendation-body'); if (!root) return; root.innerHTML = '';
    if (recommendationState.loading) { root.innerHTML = '<div class="script-recommendation-loading">正在根据你的保险主线和内容支线挑选脚本…</div>'; return; }
    if (!recommendationState.groups.length) { root.innerHTML = '<div class="script-recommendation-empty">当前脚本库还没有匹配到你的方向。</div>'; return; }
    sectionDefinitions().forEach((definition) => {
      const section = document.createElement('section'); section.className = `script-direction-section script-section-${definition.key}`;
      const heading = document.createElement('div'); heading.className = 'script-direction-heading'; heading.innerHTML = `<div><h3>${escapeHtml(definition.title)}</h3><p class="script-direction-reason">${escapeHtml(definition.subtitle)}</p></div>`; section.appendChild(heading);
      const list = document.createElement('div'); list.className = 'script-card-list'; const scripts = scriptsForDirections(definition.directions);
      if (!scripts.length) { const empty = document.createElement('p'); empty.className = 'script-recommendation-empty'; empty.textContent = definition.key === 'branch' && !definition.directions.length ? '你的内容支线还没有确定。补充过往职业、生活身份或个人爱好后，我会从这里推荐对应脚本。' : '当前脚本库里还没有匹配到这一板块的脚本。'; list.appendChild(empty); }
      else scripts.forEach((script) => renderScriptCard(script, list)); section.appendChild(list); root.appendChild(section);
    });
  }
  async function loadLibrary(force = false) {
    if (recommendationState.loading) return; if (!force && recommendationState.library) return renderLibrary();
    recommendationState.loading = true; renderLibrary();
    try {
      const query = new URLSearchParams({ page: String(recommendationState.libraryPage), pageSize: '20' }); if (recommendationState.libraryTag) query.set('tag', recommendationState.libraryTag);
      const response = await fetch(scriptApiUrl(`library?${query.toString()}`)); if (!response.ok) throw new Error(); recommendationState.library = await response.json();
    } catch (_) { recommendationState.library = { tags: [], scripts: [], page: 1, pages: 1 }; }
    finally { recommendationState.loading = false; renderLibrary(); }
  }
  async function loadRecommendations(force = false) {
    if (!hasIpPlan()) return loadLibrary(force);
    if (recommendationState.loading || (recommendationState.loaded && !force)) return;
    recommendationState.loading = true; renderRecommendations();
    try {
      const response = await fetch(scriptApiUrl('recommend'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentDirections: currentDirections() }) });
      if (!response.ok) throw new Error(); const payload = await response.json(); recommendationState.batch = payload.recommendation_batch || ''; recommendationState.groups = payload.groups || []; recommendationState.loaded = true;
    } catch (_) { recommendationState.groups = []; }
    finally { recommendationState.loading = false; renderRecommendations(); }
  }
  async function openDetail(scriptId, contentDirection) {
    try {
      const response = await fetch(scriptApiUrl(String(encodeURIComponent(scriptId)))); if (!response.ok) throw new Error(); const payload = await response.json();
      recommendationState.detail = payload.script; recommendationState.direction = contentDirection || ''; const detail = recommendationState.detail;
      document.getElementById('script-detail-title').textContent = detail.title_1 || '脚本详情'; document.getElementById('script-detail-meta').textContent = metaText(detail); document.getElementById('script-detail-body').textContent = detail.body || ''; document.getElementById('script-detail-screen').classList.remove('hidden'); track(detail.script_id, 'detail_click', contentDirection);
    } catch (_) { window.alert('脚本详情暂时无法打开，请稍后再试。'); }
  }
  function closeDetail() { document.getElementById('script-detail-screen')?.classList.add('hidden'); }
  function handoff(tool) {
    const detail = recommendationState.detail; if (!detail) return; const source = [detail.title_1, detail.body].filter(Boolean).join('\n'); track(detail.script_id, tool === 'script' ? 'rewrite_click' : 'xhs_click', recommendationState.direction); closeDetail(); selectTool(tool); const input = document.getElementById(tool === 'script' ? 'script-input' : 'xhs-input'); if (input) { input.value = source; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); }
  }
  function escapeHtml(value) { const div = document.createElement('div'); div.textContent = String(value || ''); return div.innerHTML; }
  if (!document.getElementById('script-library-v3-style')) {
    const style = document.createElement('style'); style.id = 'script-library-v3-style'; style.textContent = `.script-library-ip-prompt{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:16px 18px;margin-bottom:16px;border:1px solid #eadde1;border-radius:14px;background:#fff8fa}.script-library-ip-prompt p{margin:5px 0 0;color:#756970}.script-library-tags{display:flex;gap:8px;overflow-x:auto;padding:2px 0 12px}.script-library-tag{flex:0 0 auto;border:0;border-radius:999px;padding:8px 14px;background:#f5f1f2}.script-library-tag.active{background:#d31145;color:#fff}.script-library-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px}.script-library-pager{display:flex;align-items:center;justify-content:center;gap:14px;padding:18px 0}@media(max-width:640px){.script-library-ip-prompt{align-items:flex-start;flex-direction:column}.script-library-grid{grid-template-columns:1fr}}`; document.head.appendChild(style);
  }
  if (typeof selectTool === 'function') {
    const baseSelectTool = selectTool;
    selectTool = function selectToolWithRecommendation(tool) {
      if (tool !== 'recommendation') { document.getElementById('script-recommendation-panel')?.classList.add('hidden'); return baseSelectTool(tool); }
      state.activeTool = tool; document.querySelectorAll('[data-tool]').forEach((button) => button.classList.toggle('active', button.dataset.tool === tool)); ['ip-chat-panel', 'planning-panel', 'script-panel', 'xhs-panel', 'tool-placeholder'].forEach((id) => document.getElementById(id)?.classList.add('hidden')); document.getElementById('script-recommendation-panel')?.classList.remove('hidden'); document.getElementById('generate-button')?.classList.add('hidden'); document.getElementById('view-proposal')?.classList.add('hidden'); loadRecommendations();
    };
  }
  document.querySelector('[data-tool="recommendation"]')?.addEventListener('click', () => selectTool('recommendation'));
  document.getElementById('script-detail-close')?.addEventListener('click', closeDetail); document.getElementById('script-detail-rewrite')?.addEventListener('click', () => handoff('script')); document.getElementById('script-detail-xhs')?.addEventListener('click', () => handoff('xhs'));
  window.scriptRecommendationV1 = { currentDirections, loadRecommendations, openDetail };
})();
