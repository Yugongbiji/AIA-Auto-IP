const { test, expect } = require('@playwright/test');

// 真实课堂连续路径回归：不是分别验证四个页面，而是模拟同一个营销员连续使用。
// 覆盖：完整资料自动生成 IP → 内容规划承接 IP → 自动进入脚本 → 小红书排版 → 切回结果仍在；
// 同时覆盖历史档案恢复、刷新后自动登录，以及已有 IP + 内容规划时直接回到脚本工作位置。
const fullProfile = {
  name: '课堂测试用户', agentId: 'CLASS001', city: '成都', customerGroups: ['宝爸宝妈'],
  customerAges: ['35–45 岁'], insuranceYears: '8', strengths: ['专业靠谱'], honors: ['MDRT'],
  education: '本科', schoolTier: '985', overseas: '没有', contentTone: '生活化真诚', department: '成都一部'
};

const ipProposal = {
  headline: '懂家庭规划的成都靠谱搭子',
  subheadline: '用真实经历和专业判断，把复杂保障讲明白。',
  tags: ['家庭保障', '宝爸宝妈', '生活化真诚'],
  clientPortrait: { title: '目标客户画像', text: '成都 35–45 岁宝爸宝妈' },
  advantages: [{ emoji: '✨', title: '专业靠谱', text: '8 年保险服务经验' }],
  nicknameOptions: [{ name: '成都家庭规划搭子', angle: '城市 + 价值', reason: '容易理解' }],
  bios: {
    xiaohongshu: [{ label: '简介 A', focus: '生活化', lines: ['成都生活观察', '把复杂问题讲明白'] }],
    videoDouyin: [{ label: '简介 A', focus: '专业', lines: ['成都家庭规划', '友邦保险代理人 000'] }]
  },
  platformReminders: []
};

const contentPlan = {
  primaryGoal: '拓客为主',
  summary: '保险主线 + 育儿与升学，长期围绕家庭决策建立信任。',
  insuranceLine: { title: '家庭保障', reason: '与宝爸宝妈人群高度一致' },
  finalPositioning: { label: '家庭保障 + 育儿与升学', explanation: '围绕家庭长期决策持续输出' },
  candidateDirections: [{ direction: '育儿与升学', audienceFit: '高', sustainable: '高', benefit: '高', recommend: true }],
  contentDirections: [{ direction: '家庭风险决策', contentBoundary: '家庭保障与真实生活场景', roles: ['建立专业信任'], topics: ['有娃家庭先保谁', '教育金怎么想'] }],
  avoidDirections: [],
  focusReminder: '保持 1 + 1，不随意混入无关热点。'
};

async function mockClassroomApis(page, { withHistory = false } = {}) {
  await page.route('**/api/lookup**', async (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      matched: true,
      profile: fullProfile,
      history: withHistory ? [
        { role: 'assistant', content: 'IP 方案 V1 已生成。' }
      ] : [],
      proposals: withHistory ? [{ version: 1, proposal: ipProposal, model: 'mock' }] : [],
      planningHistory: withHistory ? [
        { role: 'assistant', content: '内容规划 V1 已生成。' }
      ] : [],
      contentPlans: withHistory ? [{ version: 1, plan: contentPlan, model: 'mock' }] : [],
      creativeHistory: withHistory ? [
        { tool: 'script', role: 'assistant', content: '脚本改写已完成。', result: {
          source: '历史原稿', summary: '历史脚本结果', versions: [{ label: '版本 1', focus: '清晰', text: '历史改写稿' }]
        } },
        { tool: 'xhs', role: 'assistant', content: '小红书排版已完成。', result: {
          source: '历史笔记', formattedText: '历史排版结果', risks: []
        } }
      ] : []
    })
  }));

  const ok = async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  await page.route('**/api/message', ok);
  await page.route('**/api/profile', ok);
  await page.route('**/api/content-plan/message', ok);
  await page.route('**/api/creative/message', ok);

  await page.route('**/api/generate', async (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ version: 1, proposal: ipProposal, model: 'mock' })
  }));
  await page.route('**/api/content-plan/generate', async (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ version: 1, plan: contentPlan, model: 'mock' })
  }));
  await page.route('**/api/script/rewrite', async (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      summary: '已结合当前 IP 与内容方向整理',
      breakdown: { knowledgePoints: ['家庭保障'], opening: '从真实家庭问题切入', structure: '先问题后判断', closing: '给出核对建议', ipUse: '自然带入成都宝爸宝妈服务经验', complianceAdjustments: [] },
      versions: [
        { label: '版本 1', focus: '更口语', text: '第一版课堂改写稿' },
        { label: '版本 2', focus: '更理性', text: '第二版课堂改写稿' },
        { label: '版本 3', focus: '更生活化', text: '第三版课堂改写稿' }
      ]
    })
  }));
  await page.route('**/api/xhs/format', async (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      formattedText: '课堂原文第一段\n\n课堂原文第二段', risks: []
    })
  }));
}

async function loginMatched(page) {
  await page.goto('/');
  await page.getByLabel('姓名').fill(fullProfile.name);
  await page.getByLabel('营销员编号').fill(fullProfile.agentId);
  await page.getByRole('button', { name: '匹配我的资料' }).click();
  await expect(page.locator('#workspace')).toBeVisible();
}

test.describe('真实课堂连续使用回归', () => {
  test('IP → 内容规划 → 脚本改写 → 小红书排版可以连续完成', async ({ page }) => {
    await mockClassroomApis(page);
    await loginMatched(page);

    // 完整资料应自动生成 IP 方案，而不是重复追问基础资料。
    await expect(page.locator('#messages')).not.toContainText('请补充你主要服务的城市');
    await expect(page.locator('#messages')).toContainText('你的专属 IP 方案', { timeout: 5000 });
    const ipCardCta = page.locator('#messages').getByRole('button', { name: '查看 IP 方案' });
    await expect(ipCardCta).toBeVisible();
    await ipCardCta.click();
    await expect(page.locator('#proposal-screen')).toBeVisible();
    await expect(page.locator('#proposal-content')).toContainText('懂家庭规划的成都靠谱搭子');
    await page.locator('#proposal-close').click();

    // 内容规划承接当前 IP。
    await page.locator('#tool-tabs').getByRole('button', { name: /内容规划/ }).click();
    await expect(page.locator('#planning-messages')).toContainText('这个账号接下来最想解决什么');
    await page.locator('#planning-quick-replies').getByRole('button', { name: '拓客为主' }).click();
    await page.locator('#planning-quick-replies').getByRole('button', { name: '家庭保障' }).click();
    await page.locator('#planning-form').getByRole('button', { name: '发送' }).click();
    const secondary = page.locator('#planning-quick-replies').getByRole('button', { name: '育儿与升学' });
    await expect(secondary).toBeVisible();
    await secondary.click();
    await page.locator('#planning-form').getByRole('button', { name: '发送' }).click();
    await page.getByRole('button', { name: '生成我的内容规划' }).click();
    await expect(page.locator('#planning-messages')).toContainText('你的专属内容规划方案', { timeout: 5000 });

    // 生成内容规划后应自动进入脚本工具，且脚本可直接工作。
    await expect(page.locator('#script-panel')).toBeVisible({ timeout: 3000 });
    await page.locator('#script-input').fill('这是课堂里准备改写的一段原稿，核心观点是家庭保障要先看真实需求。');
    await page.locator('#script-form').getByRole('button', { name: '开始改写' }).click();
    await expect(page.locator('#script-messages')).toContainText('脚本改写完成');
    await expect(page.locator('#script-messages .creative-textarea').first()).toHaveValue('第一版课堂改写稿');

    // 切换到小红书排版后继续使用，前一工具结果不应消失。
    await page.locator('#tool-tabs').getByRole('button', { name: /小红书排版/ }).click();
    await page.locator('#xhs-input').fill('课堂原文第一段。课堂原文第二段。');
    await page.locator('#xhs-form').getByRole('button', { name: '开始排版' }).click();
    await expect(page.locator('#xhs-messages')).toContainText('小红书排版完成');
    await expect(page.locator('#xhs-messages .creative-textarea').first()).toHaveValue('课堂原文第一段\n\n课堂原文第二段');
    await expect(page.locator('#xhs-messages')).toContainText('经过初步检测暂无风险词汇');

    await page.locator('#tool-tabs').getByRole('button', { name: /脚本改写/ }).click();
    await expect(page.locator('#script-messages .creative-textarea').first()).toHaveValue('第一版课堂改写稿');
  });

  test('刷新后能恢复课堂历史，并在多个工具间正常切换', async ({ page }) => {
    await mockClassroomApis(page, { withHistory: true });
    await loginMatched(page);

    await expect(page.locator('#messages')).toContainText('你的专属 IP 方案');
    await page.locator('#tool-tabs').getByRole('button', { name: /内容规划/ }).click();
    await expect(page.locator('#planning-messages')).toContainText('你的专属内容规划方案');

    await page.locator('#tool-tabs').getByRole('button', { name: /脚本改写/ }).click();
    await expect(page.locator('#script-messages .creative-textarea').first()).toHaveValue('历史改写稿');
    await page.locator('#tool-tabs').getByRole('button', { name: /小红书排版/ }).click();
    await expect(page.locator('#xhs-messages .creative-textarea').first()).toHaveValue('历史排版结果');

    // 本地 session 已建立，刷新时应自动重新匹配，不退回身份页。
    await page.reload();
    await expect(page.locator('#workspace')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#identity-screen')).toBeHidden();
    await expect(page.locator('#identity-state')).toContainText('课堂测试用户');

    // 有完整 IP + 内容规划历史时，刷新后应直接回到脚本工具继续工作。
    await expect(page.locator('#script-panel')).toBeVisible();
    await expect(page.locator('#script-messages .creative-textarea').first()).toHaveValue('历史改写稿');
  });
});
