const { test, expect } = require('@playwright/test');

test.describe('产品规则 V9 兼容回归', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('匹配资料缺少唯一主目标时先问拓客或增员，不直接跳到城市', async ({ page }) => {
    await page.evaluate(() => {
      startWorkspace({
        name: '测试用户',
        agentId: '123456789',
        city: '成都',
        customerGroups: '企业主',
      }, true, [], [], [], [], []);
    });
    const lastAssistant = page.locator('#messages .message.assistant').last();
    await expect(lastAssistant).toContainText(/优先帮你|拓客.*增员/);
    await expect(page.locator('#chat-input')).toHaveAttribute('placeholder', /账号优先目标/);
  });

  test('历史 purpose 为单一拓客目标时可标准化为 primaryGoal，并继续询问下一个缺失字段', async ({ page }) => {
    await page.evaluate(() => {
      startWorkspace({
        name: '测试用户',
        agentId: '123456789',
        purpose: '拓客',
        city: '成都',
      }, true, [], [], [], [], []);
    });
    const lastAssistant = page.locator('#messages .message.assistant').last();
    await expect(lastAssistant).toContainText('最希望服务哪些人群');
    const goal = await page.evaluate(() => state.profile.primaryGoal);
    expect(goal).toBe('customer_acquisition');
  });

  test('当前我的资料展示个人介绍且不展示内部生成偏好', async ({ page }) => {
    await page.getByRole('button', { name: '我不在名单中，直接开始' }).click();
    await page.evaluate(() => {
      state.profile = {
        name: '测试用户',
        agentId: '123456789',
        primaryGoal: 'customer_acquisition',
        city: '成都',
        selfIntro: '这里是历史个人介绍',
        generationNotes: '昵称更活泼',
      };
      renderProfile();
    });
    await page.locator('#aia-ip-owner-profile-button').click();
    const drawer = page.locator('#aia-ip-owner-profile-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('个人介绍');
    await expect(drawer).toContainText('这里是历史个人介绍');
    await expect(drawer).toContainText('做自媒体目的');
    await expect(drawer).toContainText('拓客');
    await expect(drawer).not.toContainText('生成偏好');
    await expect(drawer).not.toContainText('昵称更活泼');
  });
});