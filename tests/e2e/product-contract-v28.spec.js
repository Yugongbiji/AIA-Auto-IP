const { test, expect } = require('@playwright/test');

async function enterGuest(page) {
  await page.goto('/');
  await page.getByRole('button', { name: '我不在名单中，直接开始' }).click();
  await expect(page.locator('#workspace')).toBeVisible();
}

test.describe('V28 创作复制反馈契约', () => {
  test('脚本/小红书创作结果点击复制全文后必须显示复制成功', async ({ page }) => {
    await enterGuest(page);
    await page.evaluate(() => {
      const parent = document.getElementById('script-messages');
      addCreativeCopyBlock(parent, '测试稿', '', '这里是一段测试复制内容');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try { navigator.clipboard.writeText = async () => {}; } catch (_) {}
      }
    });
    const button = page.locator('#script-messages .creative-copy-block .copy-button').last();
    await button.click();
    await expect(page.locator('#aia-toast-host')).toContainText('复制成功');
    await expect(button).toContainText('复制成功');
  });

  test('V28 复制能力已加载', async ({ page }) => {
    await enterGuest(page);
    await expect.poll(() => page.evaluate(() => typeof window.aiaCreativeCopyV28?.writeClipboard)).toBe('function');
  });
});
