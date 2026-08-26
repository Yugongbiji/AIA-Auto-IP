// Release contract: content planning must use the same two-way primary-goal choice as the current IP policy.
(function () {
  'use strict';
  if (!Array.isArray(planningQuestions) || !planningQuestions.length) return;
  planningQuestions[0] = {
    key: 'primaryGoal',
    ask: '刚刚起号阶段，建议先从“拓客”和“增员”里选一个方向，不要贪多。先把一个方向做清楚，等账号运营成熟后再拓展另一个方向。现阶段你更希望这个账号优先帮你：',
    chips: ['吸引潜在客户', '吸引潜在增员对象'],
  };
})();
