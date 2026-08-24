const { test, expect } = require('@playwright/test');

async function enterGuest(page) {
  await page.goto('/');
  await page.getByRole('button', { name: '我不在名单中，直接开始' }).click();
  await expect(page.locator('#workspace')).toBeVisible();
}

test.describe('V22 公共状态与复制契约', () => {
  test('小红书 waiting 不再暴露手机阅读节奏等内部处理文案', async ({ page }) => {
    await enterGuest(page);
    await page.locator('#tool-tabs').getByRole('button', { name: /小红书排版/ }).click();
    await page.evaluate(() => {
      const node = document.createElement('div');
      node.className = 'message assistant';
      node.textContent = '正在整理手机阅读节奏、断句和留白…';
      document.getElementById('xhs-messages').appendChild(node);
    });
    await expect(page.locator('#xhs-messages')).toContainText('正在排版，请稍候…');
    await expect(page.locator('#xhs-messages')).not.toContainText('手机阅读节奏');
  });

  test('公共 Toast 组件可提供统一复制成功反馈', async ({ page }) => {
    await enterGuest(page);
    await page.evaluate(() => window.aiaToast('复制成功'));
    await expect(page.locator('#aia-toast-host')).toContainText('复制成功');
  });

  test('V22 公共能力已加载', async ({ page }) => {
    await enterGuest(page);
    await expect.poll(() => page.evaluate(() => typeof window.aiaToast)).toBe('function');
    await expect.poll(() => page.evaluate(() => typeof window.normalizeXhsLoadingV22)).toBe('function');
  });
});
