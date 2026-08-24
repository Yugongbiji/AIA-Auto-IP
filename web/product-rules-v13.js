// 产品规则 V13（兼容层）：仅保留仍有效的提问文案/选项修正。
// 业务目标、内容方向、服务型简介已迁移到 ip-policy-core.js；本文件不得再写这些业务结果。
(function () {
  'use strict';

  const educationQuestion = Array.isArray(questions) ? questions.find((item) => item.key === 'education') : null;
  if (educationQuestion) {
    // 按当前产品规则：保留大专；删除“不希望填写/跳过/其他”类逃逸选项。
    educationQuestion.chips = ['大专', '本科', '硕士', '博士'];
  }

  const styleQuestion = Array.isArray(questions) ? questions.find((item) => item.key === 'contentTone') : null;
  if (styleQuestion) {
    styleQuestion.ask = '你希望自己的内容说起话来是什么感觉？可以选 1～2 个最像你的风格，也可以自己补充。这个选择会影响后续的脚本改写风格。';
  }

  window.aiaProductRulesV13 = Object.freeze({
    compatibilityOnly: true,
    ownsBusinessRules: false,
  });
})();
