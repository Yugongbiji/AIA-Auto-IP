const { test, expect } = require('@playwright/test');

async function enterGuest(page) {
  await page.goto('/');
  await page.getByRole('button', { name: '我不在名单中，直接开始' }).click();
  await expect(page.locator('#workspace')).toBeVisible();
}

test.describe('公共创作状态与 Toast 契约', () => {
  test('小红书 waiting 在进入 DOM 前统一，不暴露内部处理文案', async ({ page }) => {
    await enterGuest(page);
    await page.locator('#tool-tabs').getByRole('button', { name: /小红书排版/ }).click();
    await page.evaluate(() => {
      addCreativeMessage('xhs', '正在整理手机阅读节奏、断句和留白…', 'assistant', false);
    });
    await expect(page.locator('#xhs-messages')).toContainText('正在排版，请稍候…');
    await expect(page.locator('#xhs-messages')).not.toContainText('手机阅读节奏');
  });

  test('脚本改写 waiting 也走同一公共状态入口', async ({ page }) => {
    await enterGuest(page);
    await page.locator('#tool-tabs').getByRole('button', { name: /脚本改写/ }).click();
    await page.evaluate(() => {
      addCreativeMessage('script', '正在保留原文事实、检查合规表达，并整理 3 篇不同角度的改写稿…', 'assistant', false);
    });
    await expect(page.locator('#script-messages')).toContainText('正在改写，请稍候…');
  });

  test('公共 Toast 组件可提供统一复制成功反馈', async ({ page }) => {
    await enterGuest(page);
    await page.evaluate(() => window.aiaToast('复制成功'));
    await expect(page.locator('#aia-toast-host')).toContainText('复制成功');
  });

  test('公共状态能力已加载', async ({ page }) => {
    await enterGuest(page);
    await expect.poll(() => page.evaluate(() => typeof window.aiaToast)).toBe('function');
    await expect.poll(() => page.evaluate(() => typeof window.aiaCreativeStatus?.loadingText)).toBe('function');
  });
});
