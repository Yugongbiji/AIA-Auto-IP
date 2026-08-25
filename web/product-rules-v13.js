// IP 问卷补充规则 Owner：问题完整性、仍有效文案/选项，以及问卷保存不阻塞下一题。
// 最终业务目标/方案仍由 ip-policy-core.js 负责；本文件不得生成昵称、简介或内容方向。
(function () {
  'use strict';

  const collectIfMissing = new Set([
    'city','customerGroups','customerAges','recruitmentGroups','recruitmentAges','insuranceYears',
    'strengths','honors','education','schoolTier','overseas','contentTone','department'
  ]);

  if (Array.isArray(questions)) {
    questions.forEach((question) => {
      if (collectIfMissing.has(question.key)) question.collectIfMissing = true;
    });
  }

  const educationQuestion = Array.isArray(questions) ? questions.find((item) => item.key === 'education') : null;
  if (educationQuestion) {
    educationQuestion.ask = '你的最高学历是什么？';
    educationQuestion.chips = ['大专', '本科', '硕士', '博士'];
    educationQuestion.collectIfMissing = true;
  }

  const styleQuestion = Array.isArray(questions) ? questions.find((item) => item.key === 'contentTone') : null;
  if (styleQuestion) {
    styleQuestion.ask = '你希望自己的内容说起话来是什么感觉？可以选 1～2 个最像你的风格，也可以自己补充。这个选择会影响后续的脚本改写风格。';
    styleQuestion.chips = ['专业理性', '温暖陪伴', '干练直接', '生活化真诚', '轻松有梗', '真诚克制'];
    styleQuestion.multiple = true;
    styleQuestion.maxSelections = 2;
    styleQuestion.collectIfMissing = true;
  }

  // #132/#135：保存档案属于后台持久化，不得阻塞“下一题立即出现”。
  // 串行队列避免并发保存乱序；调用方即使 await，也会立即继续 UI 流程。
  if (typeof persistMatchedProfile === 'function') {
    const basePersistMatchedProfile = persistMatchedProfile;
    let profileSaveQueue = Promise.resolve();
    persistMatchedProfile = function questionnaireNonBlockingPersist() {
      const context = this; const args = arguments;
      profileSaveQueue = profileSaveQueue.catch(() => {}).then(() => basePersistMatchedProfile.apply(context, args));
      profileSaveQueue.catch(() => {});
      return Promise.resolve();
    };
  }

  // 表达风格最多 2 个；其它多选维持原逻辑。
  if (typeof toggleMultiOption === 'function') {
    const baseToggleMultiOption = toggleMultiOption;
    toggleMultiOption = function questionnaireToggleMultiOption(value) {
      const question = questions?.[state.currentQuestion];
      if (question?.key === 'contentTone' && !state.multiSelection.has(value) && state.multiSelection.size >= 2) return;
      return baseToggleMultiOption(value);
    };
  }

  window.aiaProductRulesV13 = Object.freeze({
    ownsQuestionnairePolicy: true,
    ownsBusinessRules: false,
    collectIfMissing: Object.freeze([...collectIfMissing]),
    profileSaveIsNonBlocking: true,
  });
})();
