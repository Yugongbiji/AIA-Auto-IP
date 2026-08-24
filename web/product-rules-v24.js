// 产品规则 V24：统一 IP 页面术语；报名资料同时选择拓客/增员时必须重新收束为单一阶段目标。
(function () {
  const purposeQuestion = Array.isArray(questions) ? questions.find((item) => item.key === 'purpose') : null;
  if (purposeQuestion) {
    purposeQuestion.ask = '刚刚起号阶段，建议先从“拓客”和“增员”里选一个方向开始，不要一开始两边都做。先把一个方向做清楚，更容易让平台和用户认识你；等账号运营成熟后，再拓展另一个方向。你这阶段想先做哪一个？';
    purposeQuestion.chips = ['拓客', '增员'];
    purposeQuestion.multiple = false;
  }

  function normalizePurpose(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (/获客/.test(text) && !/拓客/.test(text)) return text.replace(/获客/g, '拓客');
    return text;
  }

  function needsPurposeReselection(value) {
    const text = normalizePurpose(value);
    if (!text) return false;
    const hasAcquisition = /拓客/.test(text);
    const hasRecruitment = /增员/.test(text);
    return (hasAcquisition && hasRecruitment) || /都要|两者|兼顾|同时|都想|两个都|一起做|个人品牌/.test(text);
  }

  // V13 已处理部分旧值，这里把报名表/历史数据中更宽泛的“双目标”写法一起收口。
  if (typeof startWorkspace === 'function') {
    const baseStartWorkspaceV24 = startWorkspace;
    startWorkspace = function startWorkspaceV24(profile, matched, history = [], proposals = [], planningHistory = [], contentPlans = [], creativeHistory = []) {
      if (profile) {
        profile.purpose = normalizePurpose(profile.purpose);
        if (needsPurposeReselection(profile.purpose)) profile.purpose = '';
      }
      return baseStartWorkspaceV24(profile, matched, history, proposals, planningHistory, contentPlans, creativeHistory);
    };
  }

  // 首次 IP 欢迎卡使用产品文档里的标准术语：“内容方向”，不使用“表达方向”。
  if (typeof addIpWelcomeCard === 'function') {
    const baseAddIpWelcomeCardV24 = addIpWelcomeCard;
    addIpWelcomeCard = function addIpWelcomeCardV24() {
      const card = baseAddIpWelcomeCardV24();
      if (!card) return card;
      card.querySelectorAll('.creative-welcome-list p').forEach((node) => {
        if (/生成昵称、账号简介和表达方向/.test(node.textContent || '')) node.textContent = '生成昵称、账号简介和内容方向';
      });
      const intro = card.querySelector('.creative-welcome-intro');
      if (intro) intro.textContent = '我会从你的真实经历、客户方向和个人优势里，找到适合长期经营的人设定位和内容方向。';
      return card;
    };
  }

  window.aiaProductCopyRulesV24 = {
    canonicalTerms: {
      contentDirection: '内容方向',
      insuranceLine: '保险主线',
      contentBranch: '内容支线',
      acquisition: '拓客',
      recruitment: '增员',
    },
    purposeMustBeSingleAtStart: true,
  };
})();
