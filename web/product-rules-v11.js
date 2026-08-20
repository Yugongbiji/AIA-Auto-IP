// 产品规则 V11：账号表达风格 + 脚本题材适配。
(function () {
  const styleQuestion = questions.find((item) => item.key === 'contentTone');
  if (styleQuestion) {
    styleQuestion.label = '账号表达风格';
    styleQuestion.ask = '你希望自己的内容说起话来是什么感觉？可以选 1～2 个最像你的风格，也可以自己补充。';
    styleQuestion.chips = ['专业理性', '亲和温暖', '风趣幽默', '干练直接', '自然真实', '观点鲜明', '沉稳可信', '犀利敢说'];
    styleQuestion.multiple = true;
  }

  if (typeof labels !== 'undefined') labels.contentTone = '账号表达风格';

  const STYLE_GUIDES = {
    '专业理性': '表达有逻辑、有依据，先讲清楚再下结论；少夸张、少情绪化，多解释复杂概念。',
    '亲和温暖': '像一个靠谱又好相处的朋友聊天，多用自然共情和口语表达，避免说教和端着。',
    '风趣幽默': '允许轻巧比喻、反差、适度幽默和少量自然网感表达，让内容有趣但不油腻、不硬玩梗。',
    '干练直接': '少铺垫、短句优先、重点前置，说清问题就进入结论和方法，避免绕圈和过度修饰。',
    '自然真实': '像本人平时正常说话，口语化、有具体场景，不使用过度包装的营销腔，也不虚构经历。',
    '观点鲜明': '可以明确表达判断和立场，开头更有观点张力，但必须区分事实与观点，不把判断说成绝对事实。',
    '沉稳可信': '语气克制、稳定、不急着说服，强调长期视角和风险边界，避免煽动、夸张和网络热词堆砌。',
    '犀利敢说': '可以更直接指出误区、矛盾和反常识，用短而有力的判断句；犀利针对观点和问题，不针对个人，不刻薄、不羞辱。',
  };

  const LEGACY_STYLE_ALIASES = {
    '生活化真诚': '自然真实',
    '轻松有梗': '风趣幽默',
  };

  const HIGH_SENSITIVITY_PATTERN = /(死亡|身故|去世|离世|丧生|事故|车祸|坠楼|火灾|地震|洪灾|灾难|重疾|癌症|肿瘤|严重伤残|抢救|ICU|病危|悲剧|家庭创伤|患者痛苦|理赔纠纷|赔付纠纷)/i;
  const PROFESSIONAL_SERIOUS_PATTERN = /(保险责任|责任范围|保单|条款|理赔|医疗|疾病|政策|税务|税法|法律|法规|合同|养老规划|教育金|重疾险|医疗险|意外险|赔付|免责|免赔)/i;

  function selectedStyles() {
    const styles = String(state.profile.contentTone || '')
      .split(/[、,，|｜/]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => LEGACY_STYLE_ALIASES[item] || item);
    return Array.from(new Set(styles));
  }

  function classifyTopic(source) {
    const text = String(source || '');
    if (HIGH_SENSITIVITY_PATTERN.test(text)) return 'high-sensitive';
    if (PROFESSIONAL_SERIOUS_PATTERN.test(text)) return 'professional-serious';
    return 'ordinary';
  }

  function topicGuide(topic) {
    if (topic === 'high-sensitive') {
      return '本稿属于高敏感或悲伤题材。无论长期账号风格如何，本篇都必须优先尊重、克制、清楚和有人情味；关闭笑点、段子、俏皮话、网络梗，不用犀利语气评价受害者、患者或当事人，也不拿死亡、疾病、事故或赔付结果制造娱乐效果。';
    }
    if (topic === 'professional-serious') {
      return '本稿属于专业严肃题材。专业准确优先，幽默和网感只能轻度使用，不能抢内容本身；犀利只用于澄清误区，不能制造对立；不得因风格改变事实、数字、责任范围或风险提示。';
    }
    return '本稿属于普通或轻话题，可以正常体现已确认的账号表达风格，但仍不得为了人设牺牲事实、专业准确性和合规边界。';
  }

  function syncScriptStyleGuide(source = '', stylesOverride) {
    const styles = Array.isArray(stylesOverride) && stylesOverride.length
      ? stylesOverride.map((item) => LEGACY_STYLE_ALIASES[item] || item)
      : selectedStyles();
    if (!styles.length) {
      delete state.profile.scriptStyleGuide;
      delete state.profile.scriptTopicType;
      return;
    }
    const topic = classifyTopic(source);
    const details = Array.from(new Set(styles)).map((name) => STYLE_GUIDES[name]
      ? `${name}：${STYLE_GUIDES[name]}`
      : `${name}：按本人明确选择的表达风格自然改写，不自行扩展人设。`);
    state.profile.scriptTopicType = topic;
    state.profile.scriptStyleGuide = `脚本改写时参考本人已确认的账号表达风格：${details.join('；')} ${topicGuide(topic)} 风格是长期偏好，不是绝对命令；题材适配优先于机械保持人设。`;
  }

  if (typeof confirmMultiOption === 'function') {
    const baseConfirmMultiOptionV11 = confirmMultiOption;
    confirmMultiOption = async function confirmMultiOptionV11() {
      const question = questions[state.currentQuestion];
      if (question?.key === 'contentTone') syncScriptStyleGuide('', Array.from(state.multiSelection));
      return baseConfirmMultiOptionV11();
    };
  }

  if (typeof runScriptRewrite === 'function') {
    const baseRunScriptRewriteV11 = runScriptRewrite;
    runScriptRewrite = function runScriptRewriteV11(source, revision = '') {
      syncScriptStyleGuide(source);
      return baseRunScriptRewriteV11(source, revision);
    };
  }
})();
