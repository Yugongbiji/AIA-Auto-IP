// 产品规则 V6：对话适量 emoji、昵称日常称呼优先、服务型简介、隐藏不建议混入方向。
(function () {
  const hasEmoji = (text) => /[\u2600-\u27BF]|[\u{1F000}-\u{1FAFF}]/u.test(String(text || ''));

  // 1) 对话增加适量 emoji：只处理助手消息，不碰用户输入和结果正文；不是每条都加。
  const dialogueEmojiRules = [
    [/资料|信息|填写|补充/, '📋'],
    [/生成|方案|结果|完成/, '✨'],
    [/内容|方向|选题|规划/, '💡'],
    [/提醒|注意|合规|风险/, '📌'],
    [/匹配|找到|成功|已经/, '✅'],
    [/接下来|继续|下一步/, '🧭'],
  ];

  function decorateAssistantMessage(node, index) {
    if (!node || node.dataset.emojiDecorated === '1') return;
    node.dataset.emojiDecorated = '1';
    if (!node.classList.contains('assistant') && !node.classList.contains('system')) return;
    if (node.querySelector('textarea,.creative-result,.proposal-card,.bio-copy-block')) return;
    const text = node.textContent?.trim() || '';
    if (!text || hasEmoji(text)) return;
    // 保持克制：默认约每 3 条助手消息装饰 1 条；关键词强匹配时也可装饰。
    let emoji = '';
    for (const [pattern, value] of dialogueEmojiRules) {
      if (pattern.test(text)) { emoji = value; break; }
    }
    if (!emoji && index % 3 !== 1) return;
    if (!emoji) emoji = ['🙂', '✨', '💡'][index % 3];

    const firstText = [...node.childNodes].find((child) => child.nodeType === Node.TEXT_NODE && child.nodeValue.trim());
    if (firstText) firstText.nodeValue = `${emoji} ${firstText.nodeValue.trimStart()}`;
    else if (node.firstElementChild && !/^(BUTTON|TEXTAREA)$/i.test(node.firstElementChild.tagName)) {
      node.firstElementChild.insertAdjacentText('afterbegin', `${emoji} `);
    }
  }

  ['messages', 'planning-messages', 'script-messages', 'xhs-messages'].forEach((id) => {
    const root = document.getElementById(id);
    if (!root) return;
    const decorateAll = () => [...root.children].forEach((node, index) => decorateAssistantMessage(node, index));
    new MutationObserver(decorateAll).observe(root, { childList: true, subtree: false });
    decorateAll();
  });

  // 2) 昵称：优先使用“别人平时怎么称呼你”，避免直接把身份证式全名塞进昵称。
  function preferredDisplayName(profile) {
    return [profile?.preferredName, profile?.dailyName, profile?.usualName, profile?.preferredAddress]
      .map((item) => String(item || '').trim())
      .find(Boolean) || '';
  }

  function sanitizeNicknameOptions(options, profile) {
    const fullName = String(profile?.name || '').trim();
    const preferred = preferredDisplayName(profile);
    const cleaned = [];
    (Array.isArray(options) ? options : []).forEach((option) => {
      if (!option || typeof option !== 'object') return;
      let name = String(option.name || '').trim();
      if (!name) return;
      if (fullName && name.includes(fullName)) {
        name = preferred ? name.replaceAll(fullName, preferred) : name.replaceAll(fullName, '').replace(/^[·丨|\s-]+|[·丨|\s-]+$/g, '').trim();
      }
      if (!name || name === fullName) return;
      if (cleaned.some((item) => item.name === name)) return;
      cleaned.push({ ...option, name });
    });
    return cleaned;
  }

  // 3) 服务型简介：只从真实已提交字段提取；服务名控制在 4 个汉字以内，竖线分隔。
  function flattenProfileValues(value) {
    if (Array.isArray(value)) return value.flatMap(flattenProfileValues);
    if (value == null) return [];
    return String(value).split(/[、，,｜|/；;\n]+/).map((item) => item.trim()).filter(Boolean);
  }

  function extractConfirmedServices(profile) {
    const raw = [
      profile?.services,
      profile?.serviceAreas,
      profile?.serviceCapabilities,
      profile?.expertise,
      profile?.specialties,
      profile?.strengths,
    ].flatMap(flattenProfileValues);
    const servicePattern = /(规划|养老|传承|财商|法律|税务|升学|育儿|健康|教育|保障)$/;
    const excluded = new Set(['专业靠谱', '善于沟通', '有温度', '行动力强', '耐心倾听', '资源整合', '善于规划']);
    return [...new Set(raw.filter((item) => /^[\u4e00-\u9fff]{2,4}$/.test(item) && servicePattern.test(item) && !excluded.has(item)))].slice(0, 5);
  }

  function buildServiceVariant(profile, platform) {
    const services = extractConfirmedServices(profile);
    if (!services.length) return null;
    const line = services.join('｜');
    const preferred = preferredDisplayName(profile);
    const identity = preferred ? `${preferred}｜${line}` : line;
    return {
      label: '方案 C · 服务能力',
      focus: '把真实可提供的服务一眼说清楚',
      lines: platform === '小红书' ? [identity] : [identity],
    };
  }

  if (typeof renderProposal === 'function') {
    const originalRenderProposalV6 = renderProposal;
    renderProposal = function renderProposalV6(proposal, version) {
      const safe = JSON.parse(JSON.stringify(proposal || {}));
      safe.nicknameOptions = sanitizeNicknameOptions(safe.nicknameOptions, state.profile || {});
      safe.bios = safe.bios || {};
      ['xiaohongshu', 'videoDouyin'].forEach((platform) => {
        const variants = Array.isArray(safe.bios[platform]) ? [...safe.bios[platform]] : [];
        const serviceVariant = buildServiceVariant(state.profile || {}, platform);
        if (serviceVariant && !variants.some((item) => String(item?.label || '').includes('服务能力'))) variants.push(serviceVariant);
        safe.bios[platform] = variants;
      });
      return originalRenderProposalV6(safe, version);
    };
  }

  // 4) 内容规划结果不再展示“不建议混入的方向”。
  function removeAvoidDirectionsBlock() {
    const root = document.getElementById('content-plan-content');
    if (!root) return;
    const headings = [...root.querySelectorAll('h2,h3,h4,strong')];
    headings.filter((node) => /不建议混入的方向|避免混入|不建议方向/.test(node.textContent || '')).forEach((heading) => {
      const block = heading.closest('section,article,.proposal-section,.planning-section,.content-plan-section') || heading.parentElement;
      if (block && block !== root) block.remove();
    });
  }

  if (typeof renderContentPlan === 'function') {
    const originalRenderContentPlanV6 = renderContentPlan;
    renderContentPlan = function renderContentPlanV6(plan, version) {
      const safe = JSON.parse(JSON.stringify(plan || {}));
      delete safe.avoidDirections;
      const result = originalRenderContentPlanV6(safe, version);
      removeAvoidDirectionsBlock();
      return result;
    };
  }

  // 5) 字段展示：未来资料表只要提供 preferredName，就可直接进入昵称生成，不要求前端另外打补丁。
  if (typeof labels === 'object') labels.preferredName = '日常称呼';
})();
