// 产品规则 V5：集中承载本轮业务规则变化，避免把差异继续散落到多个页面补丁中。
(function () {
  // 1) IP 直接进入：姓名 -> 9 位营销员编号 -> 其余 IP 问题。
  if (!questions.some((item) => item.key === 'name')) {
    questions.unshift(
      { key: 'name', label: '姓名', ask: '先告诉我你的姓名吧。后面生成的 IP 方案会用这个名字来组织你的个人信息。', chips: [] },
      { key: 'agentId', label: '营销员编号', ask: '请输入你的 9 位营销员编号。这个编号只用于尝试匹配已有资料库：如果之前留过报名或历史资料，我就能直接带入，减少重复填写。', chips: [], inputMode: 'numeric' },
    );
  }

  // 2) 内容规划主目标只保留明确单一目标。
  if (planningQuestions[0]?.key === 'primaryGoal') planningQuestions[0].chips = ['拓客为主', '增员为主'];

  // 3) “自我介绍 / 生成偏好”不再作为当前 IP 收集或展示项；保留历史数据供内部参考。
  const baseRenderProfile = renderProfile;
  renderProfile = function renderProfileV5() {
    baseRenderProfile();
    document.querySelectorAll('#profile-card .profile-group').forEach((group) => {
      const label = group.querySelector('.profile-label')?.textContent?.trim();
      if (label === '自我介绍' || label === '生成偏好') group.remove();
    });
    const requiredKeys = [...new Set(questions.map((item) => item.key))];
    const handled = requiredKeys.filter((key) => {
      const value = state.profile[key];
      return Boolean(value) || value === '跳过' || value === '不希望填写';
    });
    $('completion').textContent = `${Math.round((handled.length / Math.max(requiredKeys.length, 1)) * 100)}%`;
  };

  // 4) 9 位营销员编号在直接进入流程中承担“二次匹配资料库”的作用。
  const baseAnswer = answer;
  answer = async function answerV5(value) {
    const content = String(value || '').trim();
    if (!content) return;
    const question = !state.done ? questions[state.currentQuestion] : null;
    if (question?.key !== 'agentId') return baseAnswer(value);
    if (['跳过', '不希望填写'].includes(content)) return baseAnswer(value);
    if (!/^\d{9}$/.test(content)) {
      addMessage('营销员编号应为 9 位数字，请再确认一下后输入。', 'assistant');
      return;
    }
    addMessage(content, 'user');
    state.profile.agentId = content;
    $('save-state').textContent = '正在匹配已有资料…';
    try {
      const response = await fetch(`/api/lookup?name=${encodeURIComponent(state.profile.name || '')}&agentId=${encodeURIComponent(content)}`);
      const result = await response.json();
      if (result.matched) {
        addMessage('已经匹配到你的已有资料，接下来只补还缺的部分。', 'system', false);
        return startWorkspace(result.profile, true, result.history || [], result.proposals || [], result.planningHistory || [], result.contentPlans || [], result.creativeHistory || []);
      }
      addMessage('暂时没有匹配到已有资料，我们继续把需要的信息补齐就好。', 'assistant', false);
    } catch (_) {
      addMessage('这次没有连上资料匹配服务，但不影响继续创建 IP，我们先往下填写。', 'assistant', false);
    }
    state.currentQuestion += 1;
    setChips(null);
    renderProfile();
    presentQuestion();
    $('save-state').textContent = '本次会话';
  };

  // 5) 简介合规声明统一在最后连续出现；视频号/抖音顺序固定且不得拆开。
  const XHS_DISCLAIMER = '本账号所述内容为个人意见，不代表任何官方意见。';
  const VIDEO_DISCLAIMER = '本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见';

  function stripComplianceLines(lines, platform) {
    return lines.filter((line) => {
      const text = String(line || '').trim();
      if (!text) return false;
      if (/本账号.*个人意见.*官方意见/.test(text)) return false;
      if (/本账号上所陈述或表达的内容仅为我个人意见/.test(text)) return false;
      if (platform !== '小红书' && /^(营销服务部|执业证编号|营销员编号)\s*[：:]/.test(text)) return false;
      return true;
    });
  }

  addCopyBlock = function addCopyBlockV5(parent, variant, platform) {
    const block = makeNode('section', 'bio-copy-block');
    const heading = makeNode('div', 'bio-copy-heading');
    const label = makeNode('div');
    label.append(makeNode('strong', '', variant.label || '简介方案'), makeNode('span', 'bio-focus', variant.focus || ''));
    let lines = stripComplianceLines(asArray(variant.lines), platform);
    if (platform === '小红书') {
      lines.push(XHS_DISCLAIMER);
    } else {
      lines.push(VIDEO_DISCLAIMER);
      lines.push(`营销服务部：${state.profile.department || 'XXX'}`);
      lines.push('执业证编号：000');
    }
    const text = lines.join('\n');
    const copy = makeNode('button', 'copy-button', '复制全文');
    copy.type = 'button'; copy.onclick = () => copyText(text, copy); heading.append(label, copy);
    const textarea = document.createElement('textarea');
    textarea.className = 'bio-textarea'; textarea.value = text; textarea.readOnly = true; textarea.rows = Math.max(4, lines.length); textarea.setAttribute('aria-label', `${platform}${variant.label || ''}简介`);
    block.append(heading, textarea);
    if (platform !== '小红书') block.append(makeNode('p', 'license-note', '上传前请将“000”替换为本人真实执业证编号。'));
    parent.appendChild(block);
  };

  // 6) 内容规划：专业主线与泛内容支线严格分开；候选只允许一个推荐并与顶部方向一致。
  const planningForbidden = /(保险|保障|保单|理赔|投保|保费|寿险|年金)/;
  const internalTerms = [
    [/保险\s*[+＋]\s*N/gi, '候选方向'],
    [/保险\s*[+＋]\s*1/gi, '最终泛内容方向'],
    [/1\s*[+＋]\s*1/g, '双主线'],
  ];

  function normalizeDirectionName(value) {
    return String(value || '').replace(/^\s*保险\s*[+＋]\s*/u, '').replace(/^泛内容[：:\s-]*/u, '').trim();
  }
  function isValidGeneralDirection(value) {
    const name = normalizeDirectionName(value);
    return Boolean(name) && !planningForbidden.test(name);
  }
  function sanitizeContentPlan(plan) {
    const cloned = JSON.parse(JSON.stringify(plan || {}));
    const candidates = (Array.isArray(cloned.candidateDirections) ? cloned.candidateDirections : [])
      .map((item) => ({ ...item, direction: normalizeDirectionName(item?.direction) }))
      .filter((item) => isValidGeneralDirection(item.direction));
    let finalName = normalizeDirectionName(cloned.finalPositioning?.label || '');
    if (!isValidGeneralDirection(finalName)) finalName = candidates[0]?.direction || '真实生活与个人积累';
    let selectedIndex = candidates.findIndex((item) => item.direction === finalName);
    if (selectedIndex < 0 && candidates.length) { selectedIndex = 0; finalName = candidates[0].direction; }
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

  if (typeof toolDetails === 'object' && toolDetails.planning) {
    toolDetails.planning.description = '以当前 IP 为基础，明确专业内容主线，再从真实经历与兴趣中确定一个长期泛内容方向。';
    toolDetails.planning.cards = [
      ['专业内容主线', '确定保障、教育金、养老等适合你的专业内容核心。'],
      ['泛内容候选', '从育儿、升学、户外、运动、法律、财商等保险以外方向中比较。'],
      ['长期内容方向', '结合拓客或增员目标，整理长期主题、选题与优先级。'],
    ];
  }

  if (typeof addPlanningWelcomeCard === 'function') {
    const originalWelcome = addPlanningWelcomeCard;
    addPlanningWelcomeCard = function planningWelcomeV5() {
      const node = originalWelcome();
      const intro = node?.querySelector('.creative-welcome-intro');
      if (intro) intro.textContent = '我会结合你已经确认的 IP、人群和真实积累，先明确专业内容主线，再从多个泛内容候选中确定一个适合长期经营的方向。';
      replaceInternalTerms(node);
      return node;
    };
  }

  planningReadyPrompt = function planningReadyPromptV5() {
    const node = document.createElement('div'); node.className = 'message assistant';
    const words = document.createElement('div'); words.textContent = '关键素材已经收到。现在可以生成第一版内容规划：一条专业内容主线，加一个最终泛内容方向。';
    const button = document.createElement('button'); button.className = 'primary confirm-update'; button.type = 'button'; button.textContent = '生成我的内容规划'; button.onclick = () => generateContentPlan();
    node.append(words, button); planningMessages().appendChild(node); planningMessages().scrollTop = planningMessages().scrollHeight;
  };

  if (typeof addSecondarySuggestionGuide === 'function') {
    const originalGuide = addSecondarySuggestionGuide;
    addSecondarySuggestionGuide = function secondaryGuideV5(suggestions) {
      const result = originalGuide(suggestions);
      replaceInternalTerms(document.getElementById('planning-messages')?.lastElementChild);
      return result;
    };
  }

  if (typeof renderContentPlan === 'function') {
    const originalRenderContentPlan = renderContentPlan;
    renderContentPlan = function renderContentPlanV5(plan, version) {
      const safePlan = sanitizeContentPlan(plan);
      const result = originalRenderContentPlan(safePlan, version);
      const root = document.getElementById('content-plan-content');
      if (root) {
        [...root.querySelectorAll('h3')].filter((item) => /候选筛选|保险\s*[+＋]\s*N/.test(item.textContent || '')).forEach((item) => { item.textContent = '🧭 候选方向'; });
        const tags = root.querySelectorAll('.proposal-tags span');
        if (tags[2]) tags[2].textContent = '专业主线 + 泛内容支线';
        root.querySelectorAll('.planning-candidate.recommended').forEach((item, index) => { if (index > 0) item.classList.remove('recommended'); });
        replaceInternalTerms(root);
      }
      return result;
    };
  }

  // 7) IP 方案：合规提示与修改次数限制合并为一个板块。
  if (typeof renderProposal === 'function') {
    const originalRenderProposal = renderProposal;
    renderProposal = function renderProposalV5(proposal, version) {
      const result = originalRenderProposal(proposal, version);
      const content = document.getElementById('proposal-content');
      const compliance = content?.querySelector('.compliance-card');
      const reminders = content?.querySelector('.platform-reminders');
      if (compliance && reminders) {
        const box = document.createElement('div'); box.className = 'compliance-reminders-inline';
        const title = document.createElement('h4'); title.textContent = '修改次数限制'; box.appendChild(title);
        reminders.querySelectorAll('p').forEach((item) => box.appendChild(item.cloneNode(true)));
        compliance.appendChild(box); reminders.remove();
      }
      return result;
    };
  }

  const style = document.createElement('style');
  style.textContent = '.compliance-reminders-inline{margin-top:18px;padding-top:16px;border-top:1px solid #eadfe3}.compliance-reminders-inline h4{margin:0 0 8px}.compliance-reminders-inline p{margin:6px 0;color:#6f666a;font-size:13px;line-height:1.6}';
  document.head.appendChild(style);

  // 8) 小红书排版：核心词优先配语义 emoji，任何连续两句话至少一个视觉锚点。
  const emojiKeywords = [
    ['理赔','✅'],['赔付','✅'],['合同','📄'],['条款','📄'],['责任','📄'],['风险','⚠️'],['提醒','⚠️'],['注意','⚠️'],
    ['健康','❤️'],['医疗','🏥'],['医院','🏥'],['教育','🎓'],['升学','🎓'],['育儿','🧸'],['孩子','🧸'],['养老','🌿'],
    ['家庭','👪'],['父母','👪'],['保障','🛡️'],['保单','🛡️'],['保险','🛡️'],['投保','📝'],['保费','🧾'],['预算','🧾'],
    ['财富','💰'],['资产','💰'],['社保','🏛️'],['医保','🏛️'],['政策','🏛️'],['法律','⚖️'],['骑行','🚴'],['跑步','🏃'],
    ['游泳','🏊'],['运动','🏅'],['户外','🏕️'],['旅行','✈️'],['企业主','🏢'],['创业','🚀'],['职场','💼'],['团队','🤝'],
    ['服务','🤝'],['沟通','💬'],['数据','📊'],['比例','📊'],['金额','📊'],['案例','🔎'],['选择','🔎'],['故事','📖'],
    ['重点','📌'],['核心','📌'],['方法','💡'],['建议','💡'],['清单','📋'],['步骤','🧭'],['计划','🧭'],
  ];
  const neutralEmojis = ['📌','💡','✨','✅'];
  function hasEmoji(text) { return /[\u2600-\u27BF]|[\u{1F000}-\u{1FAFF}]/u.test(text || ''); }
  function enrichSentence(sentence) {
    let text = sentence; let added = 0;
    for (const [keyword, emoji] of emojiKeywords) {
      if (added >= 2) break;
      const index = text.indexOf(keyword); if (index < 0) continue;
      const after = text.slice(index + keyword.length, index + keyword.length + 3); if (hasEmoji(after)) continue;
      text = `${text.slice(0, index + keyword.length)}${emoji}${text.slice(index + keyword.length)}`; added += 1;
    }
    return text;
  }
  function enrichXhsEmojiDensity(text) {
    const parts = String(text || '').split(/(?<=[。！？!?])/u).filter((part) => part.length);
    if (!parts.length) return text;
    const enriched = parts.map(enrichSentence); let neutralIndex = 0;
    for (let index = 0; index < enriched.length; index += 2) {
      const group = enriched.slice(index, index + 2);
      if (group.some(hasEmoji)) continue;
      enriched[index] = `${neutralEmojis[neutralIndex % neutralEmojis.length]} ${enriched[index].replace(/^\s+/, '')}`; neutralIndex += 1;
    }
    return enriched.join('');
  }

  if (typeof renderCreativeResult === 'function') {
    const originalRenderCreativeResult = renderCreativeResult;
    renderCreativeResult = function renderCreativeResultV5(node, tool, result) {
      if (tool === 'xhs' && result && typeof result === 'object') {
        const safe = { ...result };
        if (Array.isArray(result.formattedSections)) safe.formattedSections = result.formattedSections.map((section) => ({ ...section, text: enrichXhsEmojiDensity(section.text) }));
        if (result.formattedText) safe.formattedText = enrichXhsEmojiDensity(result.formattedText);
        return originalRenderCreativeResult(node, tool, safe);
      }
      return originalRenderCreativeResult(node, tool, result);
    };
  }

  const planningRoot = document.getElementById('planning-panel');
  if (planningRoot) {
    new MutationObserver(() => replaceInternalTerms(planningRoot)).observe(planningRoot, { childList:true, subtree:true, characterData:true });
    replaceInternalTerms(planningRoot);
  }
})();