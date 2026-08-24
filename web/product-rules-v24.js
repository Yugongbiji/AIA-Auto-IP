// 产品规则 V24（兼容层）：仅负责页面术语与欢迎文案。
// 拓客/增员的标准化和二选一由 ip-policy-core.js 唯一负责。
(function () {
  'use strict';

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

  window.aiaProductCopyRulesV24 = Object.freeze({
    canonicalTerms: {
      contentDirection: '内容方向',
      insuranceLine: '保险主线',
      contentBranch: '内容支线',
      acquisition: '拓客',
      recruitment: '增员',
    },
    compatibilityOnly: true,
    ownsBusinessRules: false,
  });
})();
