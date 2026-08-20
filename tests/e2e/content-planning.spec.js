const { test, expect } = require('@playwright/test');

async function enterGuestPlanning(page) {
  await page.goto('/');
  await page.getByRole('button', { name: '我不在名单中，直接开始' }).click();
  await expect(page.locator('#workspace')).toBeVisible();
  await page.locator('#tool-tabs').getByRole('button', { name: /内容规划/ }).click();
  await expect(page.locator('#planning-panel')).toBeVisible();
}

test.describe('内容规划完整流程', () => {
  test('首次进入主目标只允许拓客或增员，并完成 1 + N → 1 + 1 收集流程', async ({ page }) => {
    await enterGuestPlanning(page);

    await expect(page.locator('#planning-messages')).toContainText('这个账号接下来最想解决什么');
    await expect(page.locator('#planning-quick-replies').getByRole('button', { name: '拓客为主' })).toBeVisible();
    await expect(page.locator('#planning-quick-replies').getByRole('button', { name: '增员为主' })).toBeVisible();
    await expect(page.locator('#planning-quick-replies').getByRole('button', { name: '两者兼顾' })).toHaveCount(0);
    await page.locator('#planning-quick-replies').getByRole('button', { name: '拓客为主' }).click();

    await expect(page.locator('#planning-messages')).toContainText('保险这条主线');
    const insuranceChoice = page.locator('#planning-quick-replies').getByRole('button', { name: '家庭保障' });
    await insuranceChoice.click();
    await expect(insuranceChoice).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#planning-input')).not.toBeFocused();
    await expect(page.locator('#planning-form .composer-selection-chip').filter({ hasText: '家庭保障' })).toHaveCount(1);
    await page.locator('#planning-form').getByRole('button', { name: '发送' }).click();

    await expect(page.locator('#planning-messages')).toContainText('最终只会为账号确认一个最合适的“保险 + 1”');
    const fallbackChoice = page.locator('#planning-quick-replies').getByRole('button', { name: '从真实经历中筛选第二主线' });
    await expect(fallbackChoice).toBeVisible();
    await fallbackChoice.click();
    await expect(page.locator('#planning-form .composer-selection-chip').filter({ hasText: '从真实经历中筛选第二主线' })).toHaveCount(1);
    await page.locator('#planning-form').getByRole('button', { name: '发送' }).click();

    await expect(page.locator('#planning-messages')).toContainText('关键素材已经收到');
    await expect(page.getByRole('button', { name: '生成我的内容规划' })).toBeVisible();
  });

  test('发送回答后下一题保持在可视区域', async ({ page }) => {
    await enterGuestPlanning(page);
    await page.locator('#planning-quick-replies').getByRole('button', { name: '增员为主' }).click();
    await expect(page.locator('#planning-messages')).toContainText('保险这条主线');
    await page.waitForTimeout(500);

    const visible = await page.evaluate(() => {
      const box = document.querySelector('#planning-messages');
      const last = box ? [...box.querySelectorAll('.message')].at(-1) : null;
      if (!box || !last) return false;
      const container = box.getBoundingClientRect();
      const item = last.getBoundingClientRect();
      return item.bottom <= container.bottom + 2 && item.top >= container.top - 2;
    });
    expect(visible).toBeTruthy();
  });
});
