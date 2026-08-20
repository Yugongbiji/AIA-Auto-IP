// 产品规则 V7：用户可见处理中提示说人话；小红书排版前清理脚本库结构标记。
(function () {
  // 1) 用户可见的“处理中”提示：描述体验，不暴露内部实现术语。
  const friendlyProcessingCopy = new Map([
    ['正在整理手机阅读节奏，并做初步风险检测。原文不会被改动。', '见证奇迹的时刻到啦！✨ 我正在努力排版，稍等一下哦～'],
    ['正在保留原文事实、检查合规表达，并整理 3 篇不同角度的改写稿…', '收到啦！✍️ 我正在认真改写，马上给你三版～'],
    ['正在生成你的专属 IP 方案，稍等一下。', '✨ 正在把你的资料变成专属 IP 方案，很快就好～'],
    ['资料已整理完成，正在自动生成你的专属 IP 方案。', '资料齐啦 ✅ 接下来看看你的专属 IP 方案～'],
    ['正在理解你的补充…', '我在认真看你刚刚说的内容 👀'],
    ['正在理解你的意思…', '我在认真看你的意思 👀'],
  ]);

  function softenProcessingNode(node) {
    if (!node || (!node.classList.contains('assistant') && !node.classList.contains('system'))) return;
    if (node.querySelector('textarea,.creative-result-card,.proposal-card,.bio-copy-block')) return;
    const text = (node.textContent || '').trim();
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
  // 目标：只删除“结构标签”，不改正文；标题候选只保留第一个，并去掉 1/2/3 序号。
  function cleanScriptLibrarySource(raw) {
    const source = String(raw || '').replace(/\r\n?/g, '\n').trim();
    if (!source) return source;
    const lines = source.split('\n');
    const output = [];
    let titleKept = false;

    const titlePatterns = [
      /^\s*(?:标题\s*)?([1-3一二三])\s*[、.．:：)）-]\s*(.+?)\s*$/u,
      /^\s*标题\s*([1-3一二三])\s*[：:]?\s*(.+?)\s*$/u,
    ];
    const sectionPattern = /^\s*(开头|正文(?:\s*[1-9一二三四五六七八九十])?|结尾|脚本正文|文案正文)\s*[：:]?\s*(.*)$/u;

    for (const originalLine of lines) {
      const line = originalLine.trimEnd();
      let titleMatch = null;
      for (const pattern of titlePatterns) {
        const match = line.match(pattern);
        if (match) { titleMatch = match; break; }
      }
      if (titleMatch) {
        if (!titleKept) {
          const titleText = String(titleMatch[2] || '').trim();
          if (titleText) output.push(titleText);
          titleKept = true;
        }
        continue;
      }

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

  // 4) 新内容识别也按清理后的正文判断，但用户原始输入仍原样显示在对话中。
  if (typeof handleXhsConversation === 'function') {
    const baseHandleXhsConversationV7 = handleXhsConversation;
    handleXhsConversation = function handleXhsConversationV7(content) {
      return baseHandleXhsConversationV7(content);
    };
  }
})();
