// 产品规则 V23：IP 资料追加“身边人怎么看我”摘要；有数据才展示，不把内部字段裸露给用户。
(function () {
  function addItems(parent, title, items, withCount = false) {
    if (!Array.isArray(items) || !items.length) return;
    const block = document.createElement('div'); block.className = 'peer-review-block';
    const heading = document.createElement('strong'); heading.textContent = title; block.appendChild(heading);
    const chips = document.createElement('div'); chips.className = 'peer-review-chips';
    items.slice(0, 8).forEach((item) => {
      const chip = document.createElement('span');
      chip.textContent = withCount && Number(item?.count || 0) > 0 ? `${item.label} × ${item.count}` : (item?.label || '');
      if (chip.textContent) chips.appendChild(chip);
    });
    block.appendChild(chips); parent.appendChild(block);
  }

  function renderPeerReviewSummary() {
    const card = document.getElementById('profile-card');
    if (!card) return;
    card.querySelector('.peer-review-summary')?.remove();
    const summary = state.profile?.peerReviewSummary;
    if (!summary || !Number(summary.reviewCount || 0)) return;

    const details = document.createElement('details'); details.className = 'peer-review-summary';
    const toggle = document.createElement('summary');
    toggle.innerHTML = `<span>💬 身边人怎么看我</span><small>${Number(summary.reviewCount || 0)} 份反馈</small>`;
    details.appendChild(toggle);
    const body = document.createElement('div'); body.className = 'peer-review-body';
    addItems(body, '大家平时怎么称呼我', summary.topNicknames, true);
    addItems(body, '高频印象', summary.topTraits);
    addItems(body, '大家更愿意找我聊', summary.topTopics);
    addItems(body, '别人眼中的角色', summary.topRoles);
    const quotes = Array.isArray(summary.representativeQuotes) ? summary.representativeQuotes.filter(Boolean).slice(0, 3) : [];
    if (quotes.length) {
      const block = document.createElement('div'); block.className = 'peer-review-block peer-review-quotes';
      const heading = document.createElement('strong'); heading.textContent = '代表性评价'; block.appendChild(heading);
      quotes.forEach((quote) => { const p = document.createElement('p'); p.textContent = `“${quote}”`; block.appendChild(p); }); body.appendChild(block);
    }
    const note = document.createElement('p'); note.className = 'peer-review-note'; note.textContent = '这些反馈来自你邀请填写的身边人评价，会用于昵称、人设和内容方向判断。'; body.appendChild(note);
    details.appendChild(body); card.appendChild(details);
  }

  if (typeof renderProfile === 'function') {
    const baseRenderProfileV23 = renderProfile;
    renderProfile = function renderProfileV23() {
      const result = baseRenderProfileV23();
      renderPeerReviewSummary();
      return result;
    };
  }

  if (!document.getElementById('peer-review-v23-style')) {
    const style = document.createElement('style'); style.id = 'peer-review-v23-style';
    style.textContent = `
      .peer-review-summary{margin-top:14px;border-top:1px solid #eee5e8;padding-top:10px}
      .peer-review-summary>summary{display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;list-style:none;padding:8px 0;font-weight:700;color:#41383c}
      .peer-review-summary>summary::-webkit-details-marker{display:none}
      .peer-review-summary>summary small{font-size:12px;color:#8b7d83;font-weight:600}
      .peer-review-body{padding:4px 0 8px;display:grid;gap:12px}
      .peer-review-block>strong{display:block;margin-bottom:7px;font-size:12px;color:#776a70}
      .peer-review-chips{display:flex;flex-wrap:wrap;gap:6px}
      .peer-review-chips span{padding:5px 9px;border-radius:999px;background:#f7f2f4;color:#5e5157;font-size:12px}
      .peer-review-quotes p{margin:6px 0;padding:8px 10px;border-left:2px solid #d9a8b7;background:#fff9fb;color:#65585e;font-size:12px;line-height:1.55}
      .peer-review-note{margin:0;color:#978990;font-size:11px;line-height:1.5}
    `; document.head.appendChild(style);
  }

  renderPeerReviewSummary();
})();
