const { test, expect } = require('@playwright/test');

test.describe('产品规则 V9 回归', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('匹配资料缺少自媒体目的时先问 purpose，不直接跳到城市', async ({ page }) => {
    await page.evaluate(() => {
      startWorkspace({
        name: '测试用户',
        agentId: '123456789',
        city: '成都',
        customerGroups: '企业主',
      }, true, [], [], [], [], []);
    });
    const lastAssistant = page.locator('#messages .message.assistant').last();
    await expect(lastAssistant).toContainText('做自媒体最主要想达到什么目的');
    await expect(page.locator('#chat-input')).toHaveAttribute('placeholder', /做自媒体目的/);
  });

  test('已有 purpose 时跳过 purpose，继续询问下一个缺失字段', async ({ page }) => {
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
  });

  test('IP 资料卡不展示生成偏好和个人介绍', async ({ page }) => {
    await page.evaluate(() => {
      state.profile = {
        name: '测试用户',
        agentId: '123456789',
        purpose: '拓客',
        city: '成都',
        selfIntro: '这里是历史个人介绍',
        generationNotes: '昵称更活泼',
      };
      renderProfile();
    });
    await expect(page.locator('#profile-card')).not.toContainText('生成偏好');
    await expect(page.locator('#profile-card')).not.toContainText('个人介绍');
    await expect(page.locator('#profile-card')).not.toContainText('自我介绍');
    await expect(page.locator('#profile-card')).toContainText('做自媒体目的');
  });
});
