// 产品规则 V11：将“希望呈现的气质”升级为可直接作用于脚本改写的“账号表达风格”。
(function () {
  const styleQuestion = questions.find((item) => item.key === 'contentTone');
  if (styleQuestion) {
    styleQuestion.label = '账号表达风格';
    styleQuestion.ask = '你希望自己的内容说起话来是什么感觉？可以选 1～2 个最像你的风格，也可以自己补充。';
    styleQuestion.chips = ['专业理性', '亲和温暖', '风趣幽默', '干练直接', '生活化真诚', '观点鲜明', '沉稳可信', '轻松有梗'];
    styleQuestion.multiple = true;
  }

  if (typeof labels !== 'undefined') labels.contentTone = '账号表达风格';

  const STYLE_GUIDES = {
    '专业理性': '表达有逻辑、有依据，先讲清楚再下结论；少夸张、少情绪化，多解释复杂概念。',
    '亲和温暖': '像一个靠谱又好相处的朋友聊天，多用自然共情和生活化表达，避免说教和端着。',
    '风趣幽默': '允许轻巧比喻、反差和适度幽默，让内容有趣但不油腻；不能为了搞笑牺牲事实和专业准确性。',
    '干练直接': '少铺垫、短句优先、重点前置，说清问题就进入结论和方法，避免绕圈和过度修饰。',
    '生活化真诚': '像真实的人讲自己的观察和经验，语言口语化、有具体场景，不使用过度包装的营销腔。',
    '观点鲜明': '可以明确表达判断和立场，开头更有观点张力，但必须保留边界，不把个人判断说成绝对事实。',
    '沉稳可信': '语气克制、稳定、不急着说服，强调长期视角和风险边界，避免煽动、夸张和网络热词堆砌。',
    '轻松有梗': '整体节奏轻松，可以自然使用少量网感表达、梗和俏皮话，但不硬玩梗、不连续抖机灵。',
  };

  function selectedStyles() {
    return String(state.profile.contentTone || '')
      .split(/[、,，|｜/]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function syncScriptStyleGuide(stylesOverride) {
    const styles = Array.isArray(stylesOverride) && stylesOverride.length ? stylesOverride : selectedStyles();
    if (!styles.length) {
      delete state.profile.scriptStyleGuide;
      return;
    }
    const details = styles.map((name) => STYLE_GUIDES[name] ? `${name}：${STYLE_GUIDES[name]}` : `${name}：按本人明确选择的表达风格自然改写，不自行扩展人设。`);
    state.profile.scriptStyleGuide = `脚本改写时必须优先遵循本人已确认的账号表达风格：${details.join('；')} 风格只影响表达方式，不得改变原稿事实、数字、产品责任、核心观点或合规边界。`;
  }

  if (typeof confirmMultiOption === 'function') {
    const baseConfirmMultiOptionV11 = confirmMultiOption;
    confirmMultiOption = async function confirmMultiOptionV11() {
      const question = questions[state.currentQuestion];
      if (question?.key === 'contentTone') syncScriptStyleGuide(Array.from(state.multiSelection));
      return baseConfirmMultiOptionV11();
    };
  }

  if (typeof runScriptRewrite === 'function') {
    const baseRunScriptRewriteV11 = runScriptRewrite;
    runScriptRewrite = function runScriptRewriteV11(source, revision = '') {
      syncScriptStyleGuide();
      return baseRunScriptRewriteV11(source, revision);
    };
  }
})();
