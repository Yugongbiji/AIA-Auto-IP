// 产品规则 V25：精简长期身份问题；Preview 专用测试会话隔离与清空入口。
(function () {
  const lifeRoles = Array.isArray(questions) ? questions.find((item) => item.key === 'lifeRoles') : null;
  if (lifeRoles) {
    lifeRoles.ask = '除了保险从业者之外，你还有哪些长期身份？比如宝爸宝妈、创业者等。真实身份也可以成为内容支线。可多选，也可以自己补充。';
    lifeRoles.chips = (lifeRoles.chips || []).filter((item) => !['子女照护者', '其他', '其它', '跳过', '不希望填写', '暂不填写'].includes(String(item || '').trim()));
  }

  const isPreview = window.location.pathname === '/preview' || window.location.pathname.startsWith('/preview/');
  if (!isPreview) return;

  // 121：Preview 验收必须以“本次明确输入的身份”为准。
  // app.js 会在加载末尾异步恢复旧 SESSION_KEY；若用户同时手工输入新姓名/编号，旧请求可能后返回并覆盖新身份。
  // Preview 不需要自动恢复旧测试账号，因此加载后立即废弃旧 session，并拦截仍在途的旧恢复结果。
  let explicitIdentitySubmit = false;
  let staleResumeMayReturn = true;
  try { localStorage.removeItem(SESSION_KEY); } catch (_) {}

  const identityForm = document.getElementById('lookup-form');
  identityForm?.addEventListener('submit', () => {
    explicitIdentitySubmit = true;
    staleResumeMayReturn = false;
    try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
  }, true);

  document.getElementById('guest-start')?.addEventListener('click', () => {
    explicitIdentitySubmit = true;
    staleResumeMayReturn = false;
    try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
  }, true);

  if (typeof startWorkspace === 'function') {
    const baseStartWorkspace = startWorkspace;
    startWorkspace = function previewIdentityStartWorkspace(profile, matched) {
      const identityVisible = !document.getElementById('identity-screen')?.classList.contains('hidden');
      if (staleResumeMayReturn && !explicitIdentitySubmit && matched && identityVisible) {
        staleResumeMayReturn = false;
        return;
      }
      staleResumeMayReturn = false;
      explicitIdentitySubmit = false;
      return baseStartWorkspace.apply(this, arguments);
    };
  }

  function ensurePreviewResetButton() {
    const account = document.querySelector('.toolbar-account');
    if (!account || document.getElementById('preview-reset-session')) return;
    const button = document.createElement('button');
    button.id = 'preview-reset-session';
    button.type = 'button';
    button.className = 'text-button preview-reset-session';
    button.textContent = '清空测试';
    button.title = '仅清空当前浏览器的测试登录状态，从登录页重新开始；不会删除数据库中的个人资料或 IP 方案。';
    button.addEventListener('click', () => {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.clear();
      const url = new URL(window.location.href);
      url.search = '';
      url.hash = '';
      window.location.replace(url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`);
    });
    account.appendChild(button);
  }

  if (!document.getElementById('preview-reset-session-style')) {
    const style = document.createElement('style');
    style.id = 'preview-reset-session-style';
    style.textContent = '.preview-reset-session{white-space:nowrap;color:#8a5a68}.preview-reset-session:hover{color:#d31145}@media(max-width:720px){.preview-reset-session{font-size:12px;padding:6px 8px}}';
    document.head.appendChild(style);
  }

  // toolbar-account 是静态骨架节点；一次挂载足够，不允许为测试按钮监听整个 document.body。
  ensurePreviewResetButton();
})();
