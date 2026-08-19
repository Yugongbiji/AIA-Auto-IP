const { test, expect } = require('@playwright/test');

async function enterGuestIp(page) {
  await page.goto('/');
  await page.getByRole('button', { name: '我不在名单中，直接开始' }).click();
  await expect(page.locator('#workspace')).toBeVisible();
  await expect(page.locator('#ip-chat-panel')).toBeVisible();
}

async function reachFirstMultiQuestion(page) {
  await enterGuestIp(page);
  await expect(page.locator('#messages')).toContainText('请补充你主要服务的城市');
  await page.locator('#quick-replies').getByRole('button', { name: '成都' }).click();
  await expect(page.locator('#messages')).toContainText('你最希望服务哪些人群');
  await expect(page.locator('#quick-replies')).toHaveClass(/quick-replies-v2/);
}

test.describe('AIA Auto IP 聊天交互契约', () => {
  test('首次进入 IP 后必须直接出现第一问', async ({ page }) => {
    await enterGuestIp(page);
    await expect(page.locator('#messages')).toContainText('请补充你主要服务的城市');
    await expect(page.locator('#quick-replies').getByRole('button', { name: '成都' })).toBeVisible();
  });

  test('点击多选标签不主动聚焦输入框', async ({ page }) => {
    await reachFirstMultiQuestion(page);
    const input = page.locator('#chat-input');
    await page.locator('#quick-replies').getByRole('button', { name: '企业主' }).click();
    const focusedId = await page.evaluate(() => document.activeElement && document.activeElement.id);
    expect(focusedId).not.toBe('chat-input');
    await expect(input).not.toBeFocused();
  });

  test('已选标签必须位于同一个输入编辑容器内部', async ({ page }) => {
    await reachFirstMultiQuestion(page);
    await page.locator('#quick-replies').getByRole('button', { name: '企业主' }).click();
    await page.locator('#quick-replies').getByRole('button', { name: '宝爸宝妈' }).click();

    const composer = page.locator('#chat-form');
    await expect(composer.locator('.composer-input-shell')).toBeVisible();
    await expect(composer.locator('.composer-input-shell .composer-selection-chip')).toHaveCount(2);
    await expect(composer.locator('.composer-input-shell')).toContainText('企业主');
    await expect(composer.locator('.composer-input-shell')).toContainText('宝爸宝妈');
  });

  test('上方取消和输入框内删除必须双向同步', async ({ page }) => {
    await reachFirstMultiQuestion(page);
    const option = page.locator('#quick-replies').getByRole('button', { name: '企业主' });
    await option.click();
    await expect(option).toHaveAttribute('aria-pressed', 'true');

    const chip = page.locator('#chat-form .composer-selection-chip').filter({ hasText: '企业主' });
    await chip.getByRole('button', { name: /取消选择 企业主/ }).click();
    await expect(option).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#chat-form .composer-selection-chip').filter({ hasText: '企业主' })).toHaveCount(0);
  });

  test('发送多选答案后下一题应自动进入可视区域', async ({ page }) => {
    await reachFirstMultiQuestion(page);
    await page.locator('#quick-replies').getByRole('button', { name: '企业主' }).click();
    await page.locator('#quick-replies').getByRole('button', { name: '宝爸宝妈' }).click();
    await page.getByRole('button', { name: '发送' }).click();

    await expect(page.locator('#messages')).toContainText('你的目标客户主要处在哪些年龄段');
    await page.waitForTimeout(700);

    const visible = await page.evaluate(() => {
      const box = document.querySelector('#messages');
      if (!box) return false;
      const last = [...box.querySelectorAll('.message')].at(-1);
      if (!last) return false;
      const container = box.getBoundingClientRect();
      const item = last.getBoundingClientRect();
      return item.bottom <= container.bottom + 2 && item.top >= container.top - 2;
    });
    expect(visible).toBeTruthy();
  });
});
