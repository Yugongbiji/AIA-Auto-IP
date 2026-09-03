const { test, expect } = require('@playwright/test');

test.describe('产品规则 V5 访客身份兼容回归', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('V5 只负责访客姓名和营销员编号兼容，不拥有简介与合规', async ({ page }) => {
    const ownership = await page.evaluate(() => ({
      compatibilityOnly: window.aiaProductRulesV5?.compatibilityOnly,
      ownsBio: window.aiaProductRulesV5?.ownsBio,
      ownsCompliance: window.aiaProductRulesV5?.ownsCompliance,
    }));
    expect(ownership).toEqual({ compatibilityOnly: true, ownsBio: false, ownsCompliance: false });
  });

  test('访客路径的营销员编号必须为 9 位数字', async ({ page }) => {
    await page.getByRole('button', { name: /直接开始/ }).click();
    await expect(page.locator('#messages')).toContainText('先告诉我你的姓名');
    await page.locator('#chat-input').fill('测试用户');
    await page.locator('#chat-form').getByRole('button', { name: '发送' }).click();
    await expect(page.locator('#messages')).toContainText('9 位营销员编号');
    await page.locator('#chat-input').fill('12345');
    await page.locator('#chat-form').getByRole('button', { name: '发送' }).click();
    await expect(page.locator('#messages')).toContainText('应为 9 位数字');
  });

  test('独立内容规划入口已经退出用户工作台', async ({ page }) => {
    await page.getByRole('button', { name: /直接开始/ }).click();
    await expect(page.locator('#tool-tabs [data-tool="planning"]')).toHaveCount(0);
    await expect(page.locator('#planning-panel')).toBeHidden();
    await expect(page.locator('#content-plan-screen')).toBeHidden();
  });
});