const { test, expect } = require('@playwright/test');

const fullProfile = {
  name: '课堂测试用户', agentId: '123456789', purpose: '拓客', city: '成都', customerGroups: ['宝爸宝妈'],
  customerAges: ['35–45 岁'], insuranceYears: '8年', strengths: ['专业靠谱'], honors: ['MDRT'],
  education: '本科', schoolTier: '985', overseas: '没有', contentTone: '自然真实', department: '成都一部',
  selfIntro: '平时喜欢骑行，也长期关注家庭规划。',
};

const ipProposal = {
  headline: '懂家庭规划的成都靠谱搭子', subheadline: '用真实经历和专业判断，把复杂保障讲明白。',
  tags: ['家庭保障', '宝爸宝妈', '骑行'], clientPortrait: { title: '目标客户画像', text: '成都 35–45 岁宝爸宝妈' },
  advantages: [{ emoji: '✨', title: '专业靠谱', text: '8 年保险服务经验' }],
  nicknameOptions: [{ name: '家庭规划搭子', angle: '突出专业', reason: '容易理解' }],
  bios: {
    xiaohongshu: [{ label: '简介 A', focus: '自然', lines: ['成都生活观察'] }],
    videoDouyin: [{ label: '简介 A', focus: '专业', lines: ['成都家庭规划'] }],
  }, platformReminders: [],
};

async function mockApis(page, { withHistory = false } = {}) {
  await page.route('**/api/lookup**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    matched: true, profile: fullProfile,
    history: withHistory ? [{ role: 'assistant', content: 'IP 方案 V1 已生成。' }] : [],
    proposals: withHistory ? [{ version: 1, proposal: ipProposal, model: 'mock' }] : [],
    // 旧内容规划历史仍可返回，但不应恢复成用户可见功能。
    planningHistory: withHistory ? [{ role: 'assistant', content: '旧内容规划历史。' }] : [],
    contentPlans: withHistory ? [{ version: 1, plan: { summary: '旧方案' }, model: 'mock' }] : [],
    creativeHistory: withHistory ? [
      { tool: 'script', role: 'assistant', content: '脚本改写已完成。', result: { source: '历史原稿', summary: '历史结果', versions: [{ label: '版本 1', focus: '清晰', text: '历史改写稿' }] } },
      { tool: 'xhs', role: 'assistant', content: '小红书排版已完成。', result: { source: '历史笔记', formattedText: '历史排版结果', risks: [] } },
    ] : [],
  }) }));
  const ok = async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  await page.route('**/api/message', ok); await page.route('**/api/profile', ok); await page.route('**/api/creative/message', ok);
  await page.route('**/api/generate', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: 1, proposal: ipProposal, model: 'mock' }) }));
  await page.route('**/api/script/rewrite', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    summary: '已结合当前 IP 整理', breakdown: {}, versions: [
      { label: '版本 1', focus: '更口语', text: '第一版课堂改写稿' }, { label: '版本 2', focus: '更理性', text: '第二版课堂改写稿' }, { label: '版本 3', focus: '更自然', text: '第三版课堂改写稿' },
    ],
  }) }));
  await page.route('**/api/xhs/format', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ formattedText: '课堂原文第一段\n\n课堂原文第二段', suggestedTags: [], risks: [] }) }));
}

async function login(page) {
  await page.goto('/');
  await page.getByLabel('姓名').fill(fullProfile.name);
  await page.getByLabel('营销员编号').fill(fullProfile.agentId);
  await page.getByRole('button', { name: '匹配我的资料' }).click();
  await expect(page.locator('#workspace')).toBeVisible();
}

test.describe('真实课堂连续使用回归', () => {
  test('IP 方案内直接包含内容主线，然后进入脚本和小红书', async ({ page }) => {
    await mockApis(page); await login(page);
    await expect(page.locator('#tool-tabs [data-tool="planning"]')).toHaveCount(0);
    await expect(page.locator('#messages')).toContainText('你的专属 IP 方案', { timeout: 5000 });
    await page.locator('#messages').getByRole('button', { name: '查看 IP 方案' }).click();
    await expect(page.locator('#proposal-content')).toContainText('懂家庭规划的成都靠谱搭子');
    await expect(page.locator('.ip-content-strategy')).toContainText('保险专业主线');
    await expect(page.locator('.ip-content-strategy')).toContainText('泛内容支线 · 骑行');
    await page.locator('#proposal-close').click();

    await page.locator('#tool-tabs').getByRole('button', { name: /脚本改写/ }).click();
    await page.locator('#script-input').fill('这是课堂里准备改写的一段原稿。');
    await page.locator('#script-form').getByRole('button', { name: '开始改写' }).click();
    await expect(page.locator('#script-messages .creative-textarea').first()).toHaveValue('第一版课堂改写稿');

    await page.locator('#tool-tabs').getByRole('button', { name: /小红书排版/ }).click();
    await page.locator('#xhs-input').fill('课堂原文第一段。课堂原文第二段。');
    await page.locator('#xhs-form').getByRole('button', { name: '开始排版' }).click();
    await expect(page.locator('#xhs-messages .creative-textarea').first()).toHaveValue('课堂原文第一段\n\n课堂原文第二段');
  });

  test('旧内容规划历史不恢复独立入口，刷新后脚本历史仍可使用', async ({ page }) => {
    await mockApis(page, { withHistory: true }); await login(page);
    await expect(page.locator('#tool-tabs [data-tool="planning"]')).toHaveCount(0);
    await page.locator('#tool-tabs').getByRole('button', { name: /脚本改写/ }).click();
    await expect(page.locator('#script-messages .creative-textarea').first()).toHaveValue('历史改写稿');
    await page.reload();
    await expect(page.locator('#workspace')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#tool-tabs [data-tool="planning"]')).toHaveCount(0);
  });
});
