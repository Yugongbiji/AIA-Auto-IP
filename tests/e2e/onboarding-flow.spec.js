const { test, expect } = require('@playwright/test');

async function mockLookup(page, payload) {
  await page.route('**/api/lookup**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
}

async function submitIdentity(page, name = '测试用户', agentId = 'A1001') {
  await page.goto('/');
  await page.getByLabel('姓名').fill(name);
  await page.getByLabel('营销员编号').fill(agentId);
  await page.getByRole('button', { name: '匹配我的资料' }).click();
  await expect(page.locator('#workspace')).toBeVisible();
}

test.describe('AIA Auto IP 首次进入流程', () => {
  test('匹配到部分资料时应跳过已有字段，从第一个缺失问题开始', async ({ page }) => {
    await mockLookup(page, {
      matched: true,
      profile: {
        name: '测试用户', agentId: 'A1001', city: '成都',
        customerGroups: ['宝爸宝妈'], insuranceYears: '8', honors: ['MDRT']
      },
      history: [], proposals: [], planningHistory: [], contentPlans: [], creativeHistory: []
    });
    await submitIdentity(page);

    await expect(page.locator('#messages')).toContainText(/你的部分资料|已经带入|已有/);
    await expect(page.locator('#messages')).not.toContainText('请补充你主要服务的城市');
    await expect(page.locator('#messages')).toContainText('你的目标客户主要处在哪些年龄段');
  });

  test('完全没有资料时欢迎介绍后必须直接出现第一问', async ({ page }) => {
    await mockLookup(page, {
      matched: false,
      profile: {}, history: [], proposals: [], planningHistory: [], contentPlans: [], creativeHistory: []
    });
    await submitIdentity(page, '新用户', 'NEW001');

    await expect(page.locator('#messages')).toContainText(/把“你是谁”|人设定位|长期经营/);
    await expect(page.locator('#messages')).toContainText('请补充你主要服务的城市');
    await expect(page.locator('#quick-replies').getByRole('button', { name: '成都' })).toBeVisible();
  });

  test('资料完整时不再硬问基础问题', async ({ page }) => {
    await mockLookup(page, {
      matched: true,
      profile: {
        name: '完整用户', agentId: 'FULL001', city: '成都', customerGroups: ['企业主'],
        customerAges: ['35–45 岁'], insuranceYears: '9', strengths: ['专业靠谱'], honors: ['MDRT'],
        education: '本科', schoolTier: '985', overseas: '没有', contentTone: '专业理性', department: '成都一部'
      },
      history: [], proposals: [], planningHistory: [], contentPlans: [], creativeHistory: []
    });
    await submitIdentity(page, '完整用户', 'FULL001');

    await expect(page.locator('#messages')).not.toContainText('请补充你主要服务的城市');
    await expect(page.locator('#messages')).toContainText(/资料已经|资料已|生成/);
  });
});
