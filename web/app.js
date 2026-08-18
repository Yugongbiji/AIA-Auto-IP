const SESSION_KEY = 'aia-auto-ip-session';
const state = { matched: false, profile: {}, currentQuestion: 0, done: false, version: 1, pendingUpdate: null, multiSelection: new Set(), hasHistory: false, proposals: [], generating: false };
const COMPLIANCE_TIPS = {
  allowed: [
    { emoji: '✅', title: '真实信息', text: '可表达真实的个人经历、城市、专业服务方向与已获得的荣誉。' },
    { emoji: '✅', title: '合规称谓', text: '小红书可使用“代理人”“养老规划师”等合规称谓。' },
    { emoji: '✅', title: '内容场景', text: '视频和图文笔记（非简介）可按公司规则宣传友邦。' },
  ],
  avoid: [
    { emoji: '⛔', title: '联系方式与导流', text: '简介不得写微信号、手机号、邮箱、QQ、微博、二维码或其他平台账号。' },
    { emoji: '⛔', title: '诱导行为', text: '不要写“关注送福利”“私信领资料”等引导关注或利益诱导。' },
    { emoji: '⛔', title: '小红书敏感词', text: '小红书简介避免保险、金融、理财、贷款、股票、基金、医疗、护理、教育、玄学。' },
    { emoji: '⛔', title: '品牌与编号', text: '小红书简介不得出现友邦、AIA，也不要写执业证编号。' },
    { emoji: '⛔', title: '夸大承诺', text: '避免“最好、第一、保证、稳赚、无风险”等绝对化或不实表述。' },
    { emoji: '⛔', title: '医疗引流', text: '不要引导问诊、讨论疾病，或引导到站外学习医疗知识。' },
    { emoji: '⛔', title: '招募与招商', text: '不要以个人名义招募、招聘营销员，或进行招商加盟、诱导创业投资。' },
    { emoji: '⛔', title: '账号识别号', text: '微信号、小红书号、抖音号不得包含友邦、AIA 及其拼音或缩写。' },
  ],
};

const questions = [
  { key: 'city', label: '所在城市', ask: '请补充你主要服务的城市。', chips: ['成都', '上海', '北京', '广州'] },
  { key: 'customerGroups', label: '服务人群', ask: '你最希望服务哪些人群？可多选；也可以自行输入补充。', chips: ['企业主', '职场白领', '宝爸宝妈', '都市银发', '自由职业者', '新市民'], multiple: true },
  { key: 'customerAges', label: '客户年龄段', ask: '你的目标客户主要处在哪些年龄段？可多选。', chips: ['25–35 岁', '35–45 岁', '45–55 岁', '55 岁以上'], multiple: true },
  { key: 'insuranceYears', label: '保险从业时间', ask: '你从事保险相关工作多少年？请只输入具体数字，例如 9。', chips: [], inputMode: 'numeric', suffix: '年' },
  { key: 'strengths', label: '你的优势', ask: '以下哪些最能代表你的优势？可多选，也可以自行输入补充。', chips: ['专业靠谱', '善于沟通', '有温度', '行动力强', '耐心倾听', '资源整合', '善于规划'], multiple: true },
  { key: 'honors', label: '荣誉', ask: '请选择你获得的荣誉，可多选；如有其他荣誉，也可以自行输入。', chips: ['MDRT', 'COT', 'TOT', '五星会员'], multiple: true },
  { key: 'education', label: '学历', ask: '你的最高学历是什么？这项只用于判断是否适合在昵称或简介中突出。', chips: ['本科', '硕士', '博士', '不希望填写'] },
  { key: 'schoolTier', label: '学校背景', ask: '如愿意，可补充最高学校背景，例如 985、211、QS 前 100。', chips: ['985', '211', 'QS 前 100', '跳过'] },
  { key: 'overseas', label: '留学背景', ask: '是否有留学背景？', chips: ['有', '没有', '不希望填写'] },
  { key: 'contentTone', label: '希望呈现的气质', ask: '你希望账号给人的第一感觉是什么？', chips: ['专业理性', '温暖陪伴', '干练直接', '生活化真诚'] },
  { key: 'department', label: '营销服务部', ask: '最后，请填写你的营销服务部名称，用于视频号和抖音的合规文案。', chips: [] },
];

const labels = {
  name: '姓名', agentId: '营销员编号', selfIntro: '自我介绍', purpose: '做自媒体目的', city: '所在城市',
  customerGroups: '服务人群', customerAges: '客户年龄段', insuranceYears: '保险从业时间', strengths: '你的优势', honors: '荣誉',
  education: '学历', schoolTier: '学校背景', overseas: '留学背景', contentTone: '希望呈现的气质',
  department: '营销服务部', generationNotes: '生成偏好',
};

const $ = (id) => document.getElementById(id);
const messages = $('messages');

function addMessage(text, kind = 'assistant', persist = true) {
  const node = document.createElement('div');
  node.className = `message ${kind}`;
  node.textContent = text;
  messages.appendChild(node);
  messages.scrollTop = messages.scrollHeight;
  if (persist && state.matched) persistMessage(kind, text);
  return node;
}

async function persistMessage(role, content) {
  try {
    await fetch('/api/message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: state.profile.agentId, role, content }) });
  } catch (_) { $('save-state').textContent = '暂未保存，请检查网络'; }
}

function setInputMode(question) {
  const input = $('chat-input');
  input.type = question?.inputMode === 'numeric' ? 'number' : 'text';
  input.inputMode = question?.inputMode === 'numeric' ? 'numeric' : 'text';
  input.step = question?.inputMode === 'numeric' ? '1' : '';
  input.min = question?.inputMode === 'numeric' ? '0' : '';
}

function setChips(question) {
  const area = $('quick-replies');
  area.innerHTML = '';
  if (!question) return;
  question.chips.forEach((chip) => {
    const button = document.createElement('button');
    button.textContent = chip;
    if (question.multiple) {
      button.classList.toggle('selected', state.multiSelection.has(chip));
      button.onclick = () => toggleMultiOption(chip);
    } else button.onclick = () => answer(chip);
    area.appendChild(button);
  });
  if (question.multiple) {
    Array.from(state.multiSelection).filter((value) => !question.chips.includes(value)).forEach((value) => {
      const selected = document.createElement('button');
      selected.className = 'selected custom-selected';
      selected.textContent = `${value} ×`;
      selected.onclick = () => toggleMultiOption(value);
      area.appendChild(selected);
    });
    const custom = document.createElement('div');
    custom.className = 'custom-multi-input';
    const customInput = document.createElement('input');
    customInput.placeholder = `补充其他${question.label}…`;
    const add = document.createElement('button');
    add.type = 'button'; add.textContent = '添加';
    const addCustom = () => {
      const value = customInput.value.trim();
      if (!value) return;
      state.multiSelection.add(value); customInput.value = ''; setChips(question);
    };
    add.onclick = addCustom;
    customInput.onkeydown = (event) => { if (event.key === 'Enter') { event.preventDefault(); addCustom(); } };
    custom.append(customInput, add); area.appendChild(custom);
    const confirm = document.createElement('button');
    confirm.className = 'primary multi-confirm'; confirm.textContent = `确认已选（${state.multiSelection.size}）`; confirm.disabled = state.multiSelection.size === 0;
    confirm.onclick = confirmMultiOption; area.appendChild(confirm);
  }
}

function toggleMultiOption(value) {
  if (state.multiSelection.has(value)) state.multiSelection.delete(value); else state.multiSelection.add(value);
  setChips(questions[state.currentQuestion]);
}

async function confirmMultiOption() {
  const question = questions[state.currentQuestion];
  const value = Array.from(state.multiSelection).join('、');
  if (!value) return;
  addMessage(value, 'user'); state.profile[question.key] = value; state.multiSelection = new Set(); state.currentQuestion += 1;
  setChips(null); renderProfile(); await persistMatchedProfile(); presentQuestion();
}

function presentQuestion() {
  const question = questions[state.currentQuestion];
  if (!question) return completeProfile();
  if (state.profile[question.key]) { state.currentQuestion += 1; return presentQuestion(); }
  $('chat-title').textContent = '通过对话补充你的资料';
  $('chat-input').placeholder = `填写${question.label}…`; setInputMode(question); state.multiSelection = new Set();
  addMessage(question.ask); setChips(question);
}

function renderProfile() {
  const keys = ['name', 'agentId', 'selfIntro', 'purpose', ...questions.map((q) => q.key), 'generationNotes'];
  const known = keys.filter((key) => state.profile[key]);
  $('completion').textContent = `${Math.round((known.length / keys.length) * 100)}%`;
  $('profile-card').innerHTML = keys.map((key) => `<div class="profile-group"><span class="profile-label">${labels[key] || key}</span><div class="profile-value ${state.profile[key] ? '' : 'profile-empty'}">${state.profile[key] || '待补充'}</div></div>`).join('');
  $('generate-button').disabled = !state.done;
}

function refreshProposalButton() {
  const button = $('view-proposal');
  if (state.proposals.length) { button.classList.remove('hidden'); button.textContent = `查看最新方案 · V${state.proposals[0].version}`; }
  else button.classList.add('hidden');
}

async function persistMatchedProfile() {
  if (!state.matched) return;
  const response = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: state.profile.agentId, profile: state.profile }) });
  if (response.ok) $('save-state').textContent = '已保存到历史档案';
}

function parseRevision(text) {
  const updates = {};
  const city = text.match(/(?:城市|我在)\s*(?:改为|是)?\s*(成都|上海|北京|广州|深圳|杭州|武汉|南京|苏州|重庆)/);
  if (city) updates.city = city[1];
  const target = text.match(/(?:客户画像|目标客户|服务对象|服务人群)(?:改为|是|：|:)?\s*(.+)/);
  if (target) updates.customerGroups = target[1].trim();
  const strength = text.match(/(专业靠谱|善于沟通|有温度|行动力强|耐心倾听|资源整合|善于规划)/);
  if (strength) updates.strengths = strength[1];
  const honor = text.match(/(MDRT|TOT|COT|五星会员)/i);
  if (honor) updates.honors = honor[1].toUpperCase();
  if (/(昵称|简介|学历|风格|不想突出|气质)/.test(text)) updates.generationNotes = text;
  return updates;
}

async function applyPendingUpdate(node) {
  if (!state.pendingUpdate) return;
  Object.assign(state.profile, state.pendingUpdate); state.pendingUpdate = null;
  const notice = addMessage('亲，档案已经换成这版啦。接下来重新生成方案，就能看到新效果。', 'system');
  if (node) node.replaceWith(notice);
  renderProfile(); await persistMatchedProfile();
}

function confirmRevision(updates, intro = '我读懂啦，下面这些内容准备写进档案：') {
  state.pendingUpdate = updates;
  const node = document.createElement('div'); node.className = 'message assistant';
  const title = document.createElement('strong'); title.textContent = intro;
  const detail = document.createElement('div'); detail.textContent = Object.entries(updates).map(([key, value]) => `${labels[key] || key} = ${value}`).join('；');
  const confirm = document.createElement('button'); confirm.className = 'primary confirm-update'; confirm.textContent = '就按这个改';
  const cancel = document.createElement('button'); cancel.className = 'text-button cancel-update'; cancel.textContent = '先不动';
  confirm.onclick = () => applyPendingUpdate(node);
  cancel.onclick = () => { state.pendingUpdate = null; const notice = addMessage('好，这次先不动档案。想好后再叫我，我就在这儿。', 'system'); node.replaceWith(notice); };
  node.append(title, detail, confirm, cancel); messages.appendChild(node); messages.scrollTop = messages.scrollHeight;
}

async function understandFollowUp(content) {
  const response = await fetch('/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile: state.profile, message: content }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '暂时没有听清这句话');
  return result;
}

function isGenerateRequest(content) {
  return /(?:生成|出|做).{0,8}(?:IP\s*)?方案|方案.{0,6}(?:生成|出)|^(?:帮我|请|现在|直接|可以|重新|开始).{0,10}(?:生成|出方案)/.test(content);
}

async function answer(value) {
  const content = value.trim(); if (!content) return;
  if (state.done) {
    addMessage(content, 'user');
    const confirmsUpdate = /^(就按|确认|好的|好呀|可以|改吧|执行|更新|没问题)/.test(content);
    if (state.pendingUpdate && confirmsUpdate) {
      await applyPendingUpdate();
      if (isGenerateRequest(content)) return generateProposal();
      return;
    }
    if (isGenerateRequest(content)) return generateProposal();
    $('save-state').textContent = '正在理解你的补充…';
    try {
      const result = await understandFollowUp(content);
      if (Object.keys(result.updates || {}).length) return confirmRevision(result.updates, result.reply);
      addMessage(result.reply, 'assistant');
    } catch (error) {
      const updates = parseRevision(content);
      if (Object.keys(updates).length) return confirmRevision(updates, '我先抓到了这些重点，确认一下就写进档案：');
      addMessage('亲，这句话我还没完全拿准，不过没关系。你换个说法告诉我想改什么，我会先复述给你确认。', 'assistant');
    } finally {
      $('save-state').textContent = state.matched ? '已保存到历史档案' : '本次会话';
    }
    return;
  }
  const question = questions[state.currentQuestion];
  if (question.multiple) { state.multiSelection.add(content); $('chat-input').value = ''; setChips(question); return; }
  if (question.inputMode === 'numeric' && !/^\d+(?:\.\d+)?$/.test(content)) { addMessage('请只输入从业年限的数字，例如 9。', 'assistant'); return; }
  addMessage(content, 'user'); state.profile[question.key] = ['跳过', '不希望填写'].includes(content) ? '' : `${content}${question.suffix || ''}`;
  state.currentQuestion += 1; setChips(null); renderProfile(); await persistMatchedProfile(); presentQuestion();
}

function completeProfile() {
  state.done = true; setChips(null); setInputMode(null); $('chat-input').placeholder = '可继续补充或修改资料…';
  if (!state.hasHistory) addMessage('亲，资料已整理完成。现在可以点击右侧按钮，也可以直接对我说“生成方案”。', 'system');
  renderProfile();
}

function startWorkspace(profile, matched, history = [], proposals = []) {
  state.matched = matched; state.profile = profile; state.currentQuestion = 0; state.done = false; state.hasHistory = history.length > 0;
  state.proposals = proposals.sort((a, b) => b.version - a.version); state.version = (state.proposals[0]?.version || 0) + 1; messages.innerHTML = '';
  if (matched) localStorage.setItem(SESSION_KEY, JSON.stringify({ name: profile.name, agentId: profile.agentId }));
  $('identity-screen').classList.add('hidden'); $('workspace').classList.remove('hidden');
  $('identity-state').textContent = matched ? `已匹配：${profile.name}（${profile.agentId}）` : '访客模式：资料仅保留本次会话';
  $('save-state').textContent = matched ? '已载入历史档案' : '本次会话';
  if (history.length) history.forEach((item) => addMessage(item.content, item.role, false));
  else addMessage(matched ? `你好，${profile.name}。你的报名资料已经带入，接下来补充生成方案需要的关键信息。` : '亲，欢迎加入友邦红人计划。我们会通过对话建立本次 IP 档案。');
  renderProfile(); refreshProposalButton(); presentQuestion();
}

function makeNode(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function asArray(value) { return Array.isArray(value) ? value.filter(Boolean) : []; }

function copyText(text, button) {
  navigator.clipboard?.writeText(text).then(() => { const original = button.textContent; button.textContent = '已复制'; setTimeout(() => { button.textContent = original; }, 1200); }).catch(() => { button.textContent = '请手动复制'; });
}

function addCopyBlock(parent, variant, platform) {
  const block = makeNode('section', 'bio-copy-block'); const heading = makeNode('div', 'bio-copy-heading'); const label = makeNode('div');
  label.append(makeNode('strong', '', variant.label || '简介方案'), makeNode('span', 'bio-focus', variant.focus || ''));
  const copy = makeNode('button', 'copy-button', '复制全文'); const lines = asArray(variant.lines); const text = lines.join('\n'); copy.onclick = () => copyText(text, copy);
  heading.append(label, copy); const textarea = document.createElement('textarea'); textarea.className = 'bio-textarea'; textarea.value = text; textarea.readOnly = true; textarea.rows = Math.max(4, lines.length); textarea.setAttribute('aria-label', `${platform}${variant.label || ''}简介`);
  block.append(heading, textarea); if (platform !== '小红书') block.append(makeNode('p', 'license-note', '上传前请将“000”替换为本人执业编号。')); parent.appendChild(block);
}

function createInfoCard(title, content) { const card = makeNode('section', 'proposal-card'); card.append(makeNode('h3', '', title)); if (typeof content === 'string') card.append(makeNode('p', 'proposal-copy', content)); else card.append(content); return card; }

function renderProposal(proposal, version) {
  const content = $('proposal-content'); content.innerHTML = ''; $('proposal-version').textContent = `方案 V${version}`;
  const hero = makeNode('section', 'proposal-hero'); hero.append(makeNode('p', 'eyebrow', '你的个人 IP 方案'), makeNode('h1', '', proposal.headline || '为你生成的 IP 定位'), makeNode('p', 'proposal-subheadline', proposal.subheadline || ''));
  const tags = makeNode('div', 'proposal-tags'); asArray(proposal.tags).slice(0, 3).forEach((tag) => tags.append(makeNode('span', '', tag))); hero.append(tags); content.appendChild(hero);
  const overview = makeNode('div', 'proposal-grid'); overview.append(createInfoCard(proposal.clientPortrait?.title || '🎯 目标客户画像', proposal.clientPortrait?.text || ''));
  const advantages = makeNode('div', 'compact-list advantage-list'); asArray(proposal.advantages).slice(0, 4).forEach((item) => { const row = makeNode('div', 'compact-row'); row.append(makeNode('span', 'item-emoji', item.emoji || '✨')); const words = makeNode('div'); words.append(makeNode('strong', '', item.title || ''), makeNode('span', '', item.text || '')); row.append(words); advantages.append(row); }); overview.append(createInfoCard('✨ 你的优势', advantages)); content.appendChild(overview);
  const nicknameList = makeNode('div', 'nickname-list'); asArray(proposal.nicknameOptions).slice(0, 5).forEach((item) => { const row = makeNode('div', 'nickname-option'); const words = makeNode('div'); words.append(makeNode('strong', '', item.name || ''), makeNode('span', 'nickname-angle', item.angle || ''), makeNode('p', '', item.reason || '')); const copy = makeNode('button', 'copy-button', '复制昵称'); copy.onclick = () => copyText(item.name || '', copy); row.append(words, copy); nicknameList.append(row); }); content.appendChild(createInfoCard('✍️ 推荐昵称', nicknameList));
  const bios = makeNode('section', 'proposal-card bio-section'); bios.append(makeNode('h3', '', '📱 可直接复制的平台简介'));
  const platformGrid = makeNode('div', 'platform-grid'); const xhs = makeNode('div', 'platform-column'); xhs.append(makeNode('h4', '', '小红书简介 · 两套选择')); asArray(proposal.bios?.xiaohongshu).slice(0, 2).forEach((item) => addCopyBlock(xhs, item, '小红书'));
  const video = makeNode('div', 'platform-column'); video.append(makeNode('h4', '', '视频号 / 抖音简介 · 两套选择')); asArray(proposal.bios?.videoDouyin).slice(0, 2).forEach((item) => addCopyBlock(video, item, '视频号 / 抖音')); platformGrid.append(xhs, video); bios.append(platformGrid); content.appendChild(bios);
  const compliance = makeNode('section', 'compliance-card'); compliance.append(makeNode('h3', '', '🛡️ 简介修改合规提示'), makeNode('p', 'proposal-copy', '复制后如需自行调整，请先对照以下提示。小红书简介的限制尤其严格。'));
  const complianceGrid = makeNode('div', 'compliance-grid'); const allowed = makeNode('div', 'compliance-column allowed'); allowed.append(makeNode('h4', '', '可以表达')); COMPLIANCE_TIPS.allowed.forEach((item) => { const row = makeNode('div', 'compliance-row'); row.append(makeNode('span', '', item.emoji), makeNode('p', '', `${item.title}：${item.text}`)); allowed.append(row); });
  const avoid = makeNode('div', 'compliance-column avoid'); avoid.append(makeNode('h4', '', '避免写入')); COMPLIANCE_TIPS.avoid.forEach((item) => { const row = makeNode('div', 'compliance-row'); row.append(makeNode('span', '', item.emoji), makeNode('p', '', `${item.title}：${item.text}`)); avoid.append(row); }); complianceGrid.append(allowed, avoid); compliance.append(complianceGrid); content.appendChild(compliance);
  const reminders = makeNode('section', 'platform-reminders'); reminders.append(makeNode('h3', '', '📌 平台修改机会提醒')); asArray(proposal.platformReminders).forEach((line) => reminders.append(makeNode('p', '', line))); content.appendChild(reminders);
  $('proposal-screen').classList.remove('hidden'); document.body.classList.add('proposal-open');
}

$('lookup-form').addEventListener('submit', async (event) => { event.preventDefault(); const name = $('name-input').value.trim(); const agentId = $('agent-id-input').value.trim(); const response = await fetch(`/api/lookup?name=${encodeURIComponent(name)}&agentId=${encodeURIComponent(agentId)}`); const result = await response.json(); if (result.matched) return startWorkspace(result.profile, true, result.history || [], result.proposals || []); startWorkspace({ name, agentId }, false); });
$('guest-start').onclick = () => startWorkspace({}, false);
$('switch-account').onclick = () => { localStorage.removeItem(SESSION_KEY); window.location.reload(); };
$('view-proposal').onclick = () => { if (state.proposals[0]) renderProposal(state.proposals[0].proposal, state.proposals[0].version); };
$('proposal-close').onclick = () => { $('proposal-screen').classList.add('hidden'); document.body.classList.remove('proposal-open'); };
$('chat-form').addEventListener('submit', (event) => { event.preventDefault(); answer($('chat-input').value); $('chat-input').value = ''; });
async function generateProposal() {
  if (state.generating) return;
  state.generating = true;
  const button = $('generate-button'); button.disabled = true; button.textContent = '正在生成…'; const card = addMessage('亲，正在生成你的专属 IP 方案，稍等我一下。', 'assistant', false);
  try {
    const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: state.matched ? state.profile.agentId : '', profile: state.profile }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || '生成失败');
    const version = result.version || state.version; const saved = { version, proposal: result.proposal, model: result.model }; if (state.matched) state.proposals.unshift(saved); state.version = version + 1;
    card.textContent = `方案 V${version} 已生成，正在打开预览页。`; if (state.matched) persistMessage('assistant', `IP 方案 V${version} 已生成。`); refreshProposalButton(); renderProposal(result.proposal, version);
  } catch (error) { card.textContent = `生成失败：${error.message}`; }
  finally { state.generating = false; button.disabled = false; button.textContent = '重新生成专属 IP 方案'; }
}
$('generate-button').onclick = generateProposal;

async function resumeSavedSession() {
  let saved; try { saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (_) { localStorage.removeItem(SESSION_KEY); }
  if (!saved?.name || !saved?.agentId) return;
  try { const response = await fetch(`/api/lookup?name=${encodeURIComponent(saved.name)}&agentId=${encodeURIComponent(saved.agentId)}`); const result = await response.json(); if (result.matched) startWorkspace(result.profile, true, result.history || [], result.proposals || []); else localStorage.removeItem(SESSION_KEY); }
  catch (_) { $('save-state').textContent = '无法连接资料服务'; }
}

resumeSavedSession();

