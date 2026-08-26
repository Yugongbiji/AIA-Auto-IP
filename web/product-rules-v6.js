// 产品规则 V6（对话体验层）：只负责助手消息的适量 emoji 装饰。
// 昵称与服务型简介已迁移到唯一规则源，不再在这里改 proposal。
(function () {
  'use strict';
  const hasEmoji = (text) => /[\u2600-\u27BF]|[\u{1F000}-\u{1FAFF}]/u.test(String(text || ''));
  const FIXED_CREATIVE_STATUS = new Set(['正在改写，请稍候…', '正在排版，请稍候…']);
  const dialogueEmojiRules = [
    [/资料|信息|填写|补充/, '📋'],
    [/生成|方案|结果|完成/, '✨'],
    [/内容|方向|选题|规划/, '💡'],
    [/提醒|注意|合规|风险/, '📌'],
    [/匹配|找到|成功|已经/, '✅'],
    [/接下来|继续|下一步/, '🧭'],
  ];
  function decorateAssistantMessage(node, index) {
    if (!node || node.dataset.emojiDecorated === '1') return;
    node.dataset.emojiDecorated = '1';
    if (!node.classList.contains('assistant') && !node.classList.contains('system')) return;
    if (node.querySelector('textarea,.creative-result,.proposal-card,.bio-copy-block')) return;
    const text = node.textContent?.trim() || '';
    // 创作工具固定 loading 文案由 V22 唯一负责；V6 不得再加 Emoji 或改写。
    if (FIXED_CREATIVE_STATUS.has(text)) return;
    if (!text || hasEmoji(text)) return;
    let emoji = '';
    for (const [pattern, value] of dialogueEmojiRules) { if (pattern.test(text)) { emoji = value; break; } }
    if (!emoji && index % 3 !== 1) return;
    if (!emoji) emoji = ['🙂', '✨', '💡'][index % 3];
    const firstText = [...node.childNodes].find((child) => child.nodeType === Node.TEXT_NODE && child.nodeValue.trim());
    if (firstText) firstText.nodeValue = `${emoji} ${firstText.nodeValue.trimStart()}`;
    else if (node.firstElementChild && !/^(BUTTON|TEXTAREA)$/i.test(node.firstElementChild.tagName)) node.firstElementChild.insertAdjacentText('afterbegin', `${emoji} `);
  }
  ['messages', 'planning-messages', 'script-messages', 'xhs-messages'].forEach((id) => {
    const root = document.getElementById(id); if (!root) return;
    const decorateAll = () => [...root.children].forEach((node, index) => decorateAssistantMessage(node, index));
    new MutationObserver(decorateAll).observe(root, { childList: true, subtree: false });
    decorateAll();
  });
  window.aiaDialogueDecorationV6 = Object.freeze({ ownsNickname:false, ownsBio:false, ownsCreativeStatus:false });
})();
