// 产品规则 V3：内容规划结果一致性、IP 合规板块合并、小红书 emoji 密度增强。
(function () {
  const planningForbidden = /(保险|保障|保单|理赔|投保|保费|寿险|年金)/;
  const internalTerms = [
    [/保险\s*[+＋]\s*N/gi, '候选方向'],
    [/保险\s*[+＋]\s*1/gi, '最终泛内容方向'],
    [/1\s*[+＋]\s*1/g, '双主线'],
  ];

  function stripInsurancePrefix(value) {
    return String(value || '').replace(/^\s*保险\s*[+＋]\s*/u, '').trim();
  }

  function normalizeDirectionName(value) {
    return stripInsurancePrefix(value).replace(/^泛内容[：:：\s-]*/u, '').trim();
  }

  function isValidGeneralDirection(value) {
    const name = normalizeDirectionName(value);
    return Boolean(name) && !planningForbidden.test(name);
  }

  function sanitizeContentPlan(plan) {
    const cloned = JSON.parse(JSON.stringify(plan || {}));
    const rawCandidates = Array.isArray(cloned.candidateDirections) ? cloned.candidateDirections : [];
    const candidates = rawCandidates
      .map((item) => ({ ...item, direction: normalizeDirectionName(item?.direction) }))
      .filter((item) => isValidGeneralDirection(item.direction));

    let finalName = normalizeDirectionName(cloned.finalPositioning?.label || '');
    if (!isValidGeneralDirection(finalName)) finalName = candidates[0]?.direction || '真实生活与个人积累';

    let selectedIndex = candidates.findIndex((item) => item.direction === finalName);
    if (selectedIndex < 0 && candidates.length) {
      selectedIndex = 0;
      finalName = candidates[0].direction;
    }
    candidates.forEach((item, index) => { item.recommend = index === selectedIndex; });

    cloned.candidateDirections = candidates.slice(0, 3);
    cloned.finalPositioning = {
      ...(cloned.finalPositioning || {}),
      label: finalName,
      explanation: cloned.finalPositioning?.explanation || '从真实积累、可持续性、受众宽度、人群匹配和利他价值中综合确定一个长期泛内容方向。',
    };
    return cloned;
  }

  function replaceInternalTerms(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      let value = node.nodeValue;
      internalTerms.forEach(([pattern, replacement]) => { value = value.replace(pattern, replacement); });
      if (node.nodeValue !== value) node.nodeValue = value;
    });
  }

  // 结果页：候选只允许一个推荐，并与顶部最终方向完全一致。
  if (typeof renderContentPlan === 'function') {
    const originalRenderContentPlan = renderContentPlan;
    renderContentPlan = function productRulesRenderContentPlan(plan, version) {
      const safePlan = sanitizeContentPlan(plan);
      const result = originalRenderContentPlan(safePlan, version);
      const root = document.getElementById('content-plan-content');
      if (root) {
        const headings = [...root.querySelectorAll('h3')];
        headings.filter((item) => /候选筛选|保险\s*[+＋]\s*N/.test(item.textContent || '')).forEach((item) => { item.textContent = '🧭 候选方向'; });
        const tags = root.querySelectorAll('.proposal-tags span');
        if (tags[2]) tags[2].textContent = '专业主线 + 泛内容支线';
        const recommended = root.querySelectorAll('.planning-candidate.recommended');
        recommended.forEach((item, index) => { if (index > 0) item.classList.remove('recommended'); });
        replaceInternalTerms(root);
      }
      return result;
    };
  }

  // 规划欢迎与中间文案：不再向营销员暴露内部理解词。
  if (typeof addPlanningWelcomeCard === 'function') {
    const originalWelcome = addPlanningWelcomeCard;
    addPlanningWelcomeCard = function productRulesPlanningWelcome() {
      const node = originalWelcome();
      if (node) {
        const intro = node.querySelector('.creative-welcome-intro');
        if (intro) intro.textContent = '我会结合你已经确认的 IP、人群和真实积累，先明确专业内容主线，再从多个泛内容候选中确定一个适合长期经营的方向。';
        replaceInternalTerms(node);
      }
      return node;
    };
  }

  if (typeof planningReadyPrompt === 'function') {
    planningReadyPrompt = function productRulesPlanningReadyPrompt() {
      const node = document.createElement('div');
      node.className = 'message assistant';
      const words = document.createElement('div');
      words.textContent = '关键素材已经收到。现在可以生成第一版内容规划：一条专业内容主线，加一个最终泛内容方向。';
      const button = document.createElement('button');
      button.className = 'primary confirm-update';
      button.textContent = '生成我的内容规划';
      button.onclick = () => generateContentPlan();
      node.append(words, button); planningMessages().appendChild(node); planningMessages().scrollTop = planningMessages().scrollHeight;
    };
  }

  if (typeof addSecondarySuggestionGuide === 'function') {
    const originalGuide = addSecondarySuggestionGuide;
    addSecondarySuggestionGuide = function productRulesSecondaryGuide(suggestions) {
      const node = originalGuide(suggestions);
      const parent = document.getElementById('planning-messages');
      const latest = parent?.lastElementChild;
      if (latest) replaceInternalTerms(latest);
      return node;
    };
  }

  if (typeof toolDetails === 'object' && toolDetails?.planning) {
    toolDetails.planning.description = '以当前 IP 为基础，明确专业内容主线，再从真实经历与兴趣中确定一个长期泛内容方向。';
    toolDetails.planning.cards = [
      ['专业内容主线', '确定保障、教育金、养老等适合你的专业内容核心。'],
      ['泛内容候选', '从育儿、升学、户外、运动、法律、财商等保险以外方向中比较。'],
      ['长期内容方向', '结合拓客或增员目标，整理长期主题、选题与优先级。'],
    ];
  }

  // IP 方案：把修改次数限制并入合规提示板块。
  if (typeof renderProposal === 'function') {
    const originalRenderProposal = renderProposal;
    renderProposal = function productRulesRenderProposal(proposal, version) {
      const result = originalRenderProposal(proposal, version);
      const content = document.getElementById('proposal-content');
      const compliance = content?.querySelector('.compliance-card');
      const reminders = content?.querySelector('.platform-reminders');
      if (compliance && reminders) {
        const box = document.createElement('div');
        box.className = 'compliance-reminders-inline';
        const title = document.createElement('h4');
        title.textContent = '修改次数限制';
        box.appendChild(title);
        reminders.querySelectorAll('p').forEach((item) => box.appendChild(item.cloneNode(true)));
        compliance.appendChild(box);
        reminders.remove();
      }
      return result;
    };
  }

  const emojiKeywords = [
    ['理赔','✅'],['赔付','✅'],['合同','📄'],['条款','📄'],['责任','📄'],['风险','⚠️'],['提醒','⚠️'],['注意','⚠️'],
    ['健康','❤️'],['医疗','🏥'],['医院','🏥'],['教育','🎓'],['升学','🎓'],['育儿','🧸'],['孩子','🧸'],['养老','🌿'],
    ['家庭','👪'],['父母','👪'],['保障','🛡️'],['保单','🛡️'],['保险','🛡️'],['投保','📝'],['保费','🧾'],['预算','🧾'],
    ['财富','💰'],['资产','💰'],['社保','🏛️'],['医保','🏛️'],['政策','🏛️'],['法律','⚖️'],['骑行','🚴'],['跑步','🏃'],
    ['游泳','🏊'],['运动','🏅'],['户外','🏕️'],['旅行','✈️'],['企业主','🏢'],['创业','🚀'],['职场','💼'],['团队','🤝'],
    ['服务','🤝'],['沟通','💬'],['数据','📊'],['比例','📊'],['金额','📊'],['案例','🔎'],['选择','🔎'],['故事','📖'],
    ['重点','📌'],['核心','📌'],['方法','💡'],['建议','💡'],['清单','📋'],['步骤','🧭'],['计划','🧭'],
  ];
  const neutral = ['📌','💡','✨','✅'];

  function hasEmoji(text) {
    return /[\u2600-\u27BF]|[\u{1F000}-\u{1FAFF}]/u.test(text || '');
  }

  function enrichSentence(sentence) {
    let text = sentence;
    let added = 0;
    for (const [keyword, emoji] of emojiKeywords) {
      if (added >= 2) break;
      const index = text.indexOf(keyword);
      if (index < 0) continue;
      const after = text.slice(index + keyword.length, index + keyword.length + 3);
      if (hasEmoji(after)) continue;
      text = `${text.slice(0, index + keyword.length)}${emoji}${text.slice(index + keyword.length)}`;
      added += 1;
    }
    return text;
  }

  function enrichXhsEmojiDensity(text) {
    const parts = String(text || '').split(/(?<=[。！？!?])/u).filter((part) => part.length);
    if (!parts.length) return text;
    const enriched = parts.map(enrichSentence);
    let neutralIndex = 0;
    for (let index = 0; index < enriched.length; index += 2) {
      const group = enriched.slice(index, index + 2);
      if (group.some(hasEmoji)) continue;
      const target = index;
      enriched[target] = `${neutral[neutralIndex % neutral.length]} ${enriched[target].replace(/^\s+/, '')}`;
      neutralIndex += 1;
    }
    return enriched.join('');
  }

  // 小红书结果展示层确定性增强：语义关键词优先，最多连续两句无 emoji。
  if (typeof renderCreativeResult === 'function') {
    const originalRenderCreativeResult = renderCreativeResult;
    renderCreativeResult = function productRulesRenderCreativeResult(node, tool, result) {
      if (tool === 'xhs' && result && typeof result === 'object') {
        const safe = { ...result };
        if (Array.isArray(result.formattedSections)) {
          safe.formattedSections = result.formattedSections.map((section) => ({ ...section, text: enrichXhsEmojiDensity(section.text) }));
        }
        if (result.formattedText) safe.formattedText = enrichXhsEmojiDensity(result.formattedText);
        return originalRenderCreativeResult(node, tool, safe);
      }
      return originalRenderCreativeResult(node, tool, result);
    };
  }

  // 运行期兜底：规划区域新增文本时持续移除内部术语。
  const planningRoot = document.getElementById('planning-panel');
  if (planningRoot) {
    new MutationObserver(() => replaceInternalTerms(planningRoot)).observe(planningRoot, { childList:true, subtree:true, characterData:true });
    replaceInternalTerms(planningRoot);
  }
})();