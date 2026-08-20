// 脚本推荐 V1：直接复用 IP 方案里的内容方向，不另造一套标签体系。
(function () {
  const recommendationState = { loaded: false, loading: false, batch: '', groups: [], detail: null, direction: '' };

  function latestProposal() { return state.proposals?.[0]?.proposal || {}; }

  function currentDirections() {
    if (typeof window.buildIpContentStrategy !== 'function') return [];
    const strategy = window.buildIpContentStrategy(state.profile || {}, latestProposal());
    return [...new Set((strategy.lines || []).flatMap((line) => line.directions || []).filter(Boolean))];
  }

  function metaText(script) {
    const tags = [script.level1_tag, script.level2_tag].filter(Boolean);
    return [...tags, `${script.word_count || 0}字`, `${Number(script.estimated_minutes || 0).toFixed(1)}min`].join(' · ');
  }

  async function track(scriptId, eventType, contentDirection) {
    try {
      await fetch('/api/scripts/activity', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptId, eventType, agentId: state.profile?.agentId || '',
          contentDirection: contentDirection || '', recommendationBatch: recommendationState.batch || '',
        }),
      });
    } catch (_) { /* 埋点失败不能阻断用户使用 */ }
  }

  function renderRecommendations() {
    const root = document.getElementById('script-recommendation-body');
    if (!root) return;
    root.innerHTML = '';
    if (recommendationState.loading) {
      root.innerHTML = '<div class="script-recommendation-loading">正在根据你的内容主线挑选脚本…</div>';
      return;
    }
    if (!recommendationState.groups.length) {
      root.innerHTML = '<div class="script-recommendation-empty">还没有匹配到可推荐的脚本。先完成 IP 方案，或等待脚本库补充对应方向。</div>';
      return;
    }
    recommendationState.groups.forEach((group) => {
      const section = document.createElement('section'); section.className = 'script-direction-section';
      const heading = document.createElement('div'); heading.className = 'script-direction-heading';
      heading.innerHTML = `<div><h3>${escapeHtml(group.content_direction)}</h3><p class="script-direction-reason">${escapeHtml(group.reason || '')}</p></div>`;
      section.appendChild(heading);
      const list = document.createElement('div'); list.className = 'script-card-list';
      (group.scripts || []).forEach((script) => {
        const card = document.createElement('article'); card.className = 'script-recommendation-card';
        const row = document.createElement('div'); row.className = 'script-card-title-row';
        if (script.is_hot) {
          const hot = document.createElement('span'); hot.className = 'script-hot-badge'; hot.textContent = '热点'; row.appendChild(hot);
        }
        const title = document.createElement('button'); title.type = 'button'; title.className = 'script-card-title'; title.textContent = script.title || '未命名脚本';
        title.addEventListener('click', () => openDetail(script.script_id, group.content_direction)); row.appendChild(title);
        const meta = document.createElement('p'); meta.className = 'script-card-meta'; meta.textContent = metaText(script);
        card.append(row, meta); list.appendChild(card);
        track(script.script_id, 'impression', group.content_direction);
      });
      section.appendChild(list); root.appendChild(section);
    });
  }

  async function loadRecommendations() {
    if (recommendationState.loading || recommendationState.loaded) return;
    const directions = currentDirections();
    recommendationState.loading = true; renderRecommendations();
    try {
      const response = await fetch('/api/scripts/recommend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentDirections: directions }),
      });
      if (!response.ok) throw new Error('recommendation request failed');
      const payload = await response.json();
      recommendationState.batch = payload.recommendation_batch || '';
      recommendationState.groups = payload.groups || [];
      recommendationState.loaded = true;
    } catch (_) {
      recommendationState.groups = [];
      const root = document.getElementById('script-recommendation-body');
      if (root) root.innerHTML = '<div class="script-recommendation-empty">脚本推荐暂时没有加载成功，请稍后再试。</div>';
    } finally {
      recommendationState.loading = false; renderRecommendations();
    }
  }

  async function openDetail(scriptId, contentDirection) {
    try {
      const response = await fetch(`/api/scripts/${encodeURIComponent(scriptId)}`);
      if (!response.ok) throw new Error('detail request failed');
      const payload = await response.json();
      recommendationState.detail = payload.script;
      recommendationState.direction = contentDirection || '';
      const detail = recommendationState.detail;
      document.getElementById('script-detail-title').textContent = detail.title_1 || '脚本详情';
      document.getElementById('script-detail-meta').textContent = metaText(detail);
      document.getElementById('script-detail-body').textContent = detail.body || '';
      document.getElementById('script-detail-screen').classList.remove('hidden');
      track(detail.script_id, 'detail_click', contentDirection);
    } catch (_) {
      window.alert('脚本详情暂时无法打开，请稍后再试。');
    }
  }

  function closeDetail() { document.getElementById('script-detail-screen')?.classList.add('hidden'); }

  function handoff(tool) {
    const detail = recommendationState.detail;
    if (!detail) return;
    const source = [detail.title_1, detail.body].filter(Boolean).join('\n');
    track(detail.script_id, tool === 'script' ? 'rewrite_click' : 'xhs_click', recommendationState.direction);
    closeDetail();
    selectTool(tool);
    const input = document.getElementById(tool === 'script' ? 'script-input' : 'xhs-input');
    if (input) { input.value = source; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); }
  }

  function escapeHtml(value) {
    const div = document.createElement('div'); div.textContent = String(value || ''); return div.innerHTML;
  }

  if (typeof selectTool === 'function') {
    const baseSelectTool = selectTool;
    selectTool = function selectToolWithRecommendation(tool) {
      if (tool !== 'recommendation') {
        document.getElementById('script-recommendation-panel')?.classList.add('hidden');
        return baseSelectTool(tool);
      }
      state.activeTool = tool;
      document.querySelectorAll('[data-tool]').forEach((button) => button.classList.toggle('active', button.dataset.tool === tool));
      ['ip-chat-panel', 'planning-panel', 'script-panel', 'xhs-panel', 'tool-placeholder'].forEach((id) => document.getElementById(id)?.classList.add('hidden'));
      document.getElementById('script-recommendation-panel')?.classList.remove('hidden');
      document.getElementById('generate-button')?.classList.add('hidden');
      document.getElementById('view-proposal')?.classList.add('hidden');
      loadRecommendations();
    };
  }

  document.querySelector('[data-tool="recommendation"]')?.addEventListener('click', () => selectTool('recommendation'));
  document.getElementById('script-detail-close')?.addEventListener('click', closeDetail);
  document.getElementById('script-detail-rewrite')?.addEventListener('click', () => handoff('script'));
  document.getElementById('script-detail-xhs')?.addEventListener('click', () => handoff('xhs'));

  window.scriptRecommendationV1 = { currentDirections, loadRecommendations, openDetail };
})();
