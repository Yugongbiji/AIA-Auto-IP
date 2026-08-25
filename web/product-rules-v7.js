// 产品规则 V7：用户可见处理中提示说人话；小红书排版前清理脚本库结构标记。
// 创作工具固定 loading 文案由 V22 唯一负责，本层不得改写“正在改写/正在排版”状态。
(function () {
  // 1) 非创作固定状态的用户可见处理中提示：描述体验，不暴露内部实现术语。
  const friendlyProcessingCopy = new Map([
    ['正在生成你的专属 IP 方案，稍等一下。', '✨ 正在把你的资料变成专属 IP 方案，很快就好～'],
    ['资料已整理完成，正在自动生成你的专属 IP 方案。', '资料齐啦 ✅ 接下来看看你的专属 IP 方案～'],
    ['正在理解你的补充…', '我在认真看你刚刚说的内容 👀'],
    ['正在理解你的意思…', '我在认真看你的意思 👀'],
  ]);

  function softenProcessingNode(node) {
    if (!node || (!node.classList.contains('assistant') && !node.classList.contains('system'))) return;
    if (node.querySelector('textarea,.creative-result-card,.proposal-card,.bio-copy-block')) return;
    const text = (node.textContent || '').trim();
    if (text === '正在改写，请稍候…' || text === '正在排版，请稍候…') return;
    const replacement = friendlyProcessingCopy.get(text);
    if (replacement) node.textContent = replacement;
  }

  ['messages', 'planning-messages', 'script-messages', 'xhs-messages'].forEach((id) => {
    const root = document.getElementById(id);
    if (!root) return;
    const scan = () => [...root.children].forEach(softenProcessingNode);
    new MutationObserver(scan).observe(root, { childList: true, subtree: false });
    scan();
  });

  // 2) 脚本库来源清理。
  // 目标：只删除“结构标签”，不改正文；文章开头连续出现的 1/2/3 候选标题只保留第一个。
  function cleanScriptLibrarySource(raw) {
    const source = String(raw || '').replace(/\r\n?/g, '\n').trim();
    if (!source) return source;
    const lines = source.split('\n');
    const output = [];

    const titlePatterns = [
      /^\s*(?:标题\s*)?([1-3一二三])\s*[、.．:：)）-]\s*(.+?)\s*$/u,
      /^\s*标题\s*([1-3一二三])\s*[：:]?\s*(.+?)\s*$/u,
    ];
    const sectionPattern = /^\s*(开头|正文(?:\s*[1-9一二三四五六七八九十])?|结尾|脚本正文|文案正文)\s*[：:]?\s*(.*)$/u;

    // 只把文章开头连续的 1/2/3 当成“候选标题块”，避免误删正文中的正常编号列表。
    let cursor = 0;
    while (cursor < lines.length && !lines[cursor].trim()) cursor += 1;
    const titleBlock = [];
    let expected = 1;
    while (cursor < lines.length && expected <= 3) {
      const line = lines[cursor];
      let match = null;
      for (const pattern of titlePatterns) {
        const candidate = line.match(pattern);
        if (candidate) { match = candidate; break; }
      }
      if (!match) break;
      const token = String(match[1] || '');
      const normalizedNumber = ({ '一': 1, '二': 2, '三': 3 })[token] || Number(token);
      if (normalizedNumber !== expected) break;
      titleBlock.push(String(match[2] || '').trim());
      cursor += 1;
      expected += 1;
    }
    if (titleBlock.length >= 2 && titleBlock[0]) output.push(titleBlock[0]);
    else cursor = 0;

    for (; cursor < lines.length; cursor += 1) {
      const line = lines[cursor].trimEnd();
      const section = line.match(sectionPattern);
      if (section) {
        const remainder = String(section[2] || '').trim();
        if (remainder) output.push(remainder);
        continue;
      }
      output.push(line);
    }

    return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  window.cleanScriptLibrarySource = cleanScriptLibrarySource;

  // 3) 小红书排版发送前统一清理脚本库标记，避免把“标题2 / 正文1 / 结尾”等带进成品。
  if (typeof runXhsFormat === 'function') {
    const baseRunXhsFormatV7 = runXhsFormat;
    runXhsFormat = function runXhsFormatV7(source, revision = '') {
      const cleaned = cleanScriptLibrarySource(source);
      creativeState.xhs.source = cleaned;
      return baseRunXhsFormatV7(cleaned, revision);
    };
  }
})();
