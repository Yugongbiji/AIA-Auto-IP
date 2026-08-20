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
  if (planningQuestions[0]?.key === 'primaryGoal') {
    planningQuestions[0].chips = ['拓客为主', '增员为主'];
  }

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
    copy.type = 'button';
    copy.onclick = () => copyText(text, copy);
    heading.append(label, copy);

    const textarea = document.createElement('textarea');
    textarea.className = 'bio-textarea';
    textarea.value = text;
    textarea.readOnly = true;
    textarea.rows = Math.max(4, lines.length);
    textarea.setAttribute('aria-label', `${platform}${variant.label || ''}简介`);
    block.append(heading, textarea);
    if (platform !== '小红书') block.append(makeNode('p', 'license-note', '上传前请将“000”替换为本人真实执业证编号。'));
    parent.appendChild(block);
  };
})();
