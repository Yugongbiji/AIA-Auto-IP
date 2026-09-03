const { test, expect } = require('@playwright/test');

async function enterGuestIp(page) {
  await page.route('**/api/lookup**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ matched: false, profile: {}, history: [], proposals: [], planningHistory: [], contentPlans: [], creativeHistory: [] }) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '我不在名单中，直接开始' }).click();
  await expect(page.locator('#workspace')).toBeVisible();
  await expect(page.locator('#ip-chat-panel')).toBeVisible();
}

async function reachCityQuestion(page) {
  await enterGuestIp(page);
  await expect(page.locator('#messages')).toContainText('先告诉我你的姓名');
  await page.locator('#chat-input').fill('测试访客');
  await page.locator('#chat-form').getByRole('button', { name: '发送' }).click();
  await expect(page.locator('#messages')).toContainText('9 位营销员编号');
  await page.locator('#chat-input').fill('123456789');
  await page.locator('#chat-form').getByRole('button', { name: '发送' }).click();
  await expect(page.locator('#messages')).toContainText(/优先帮你|拓客.*增员/);
  await page.locator('#quick-replies').getByRole('button', { name: '吸引潜在客户', exact: true }).click();
  await expect(page.locator('#messages')).toContainText('请补充你主要服务的城市');
}

async function reachFirstMultiQuestion(page) {
  await reachCityQuestion(page);
  await page.locator('#quick-replies').getByRole('button', { name: '成都' }).click();
  await expect(page.locator('#messages')).toContainText('你最希望服务哪些人群');
  const firstChoice = page.locator('#quick-replies').getByRole('button', { name: '企业主' });
  await expect(firstChoice).toBeVisible();
  await expect(firstChoice).toHaveAttribute('aria-pressed', 'false');
}

test.describe('AIA Auto IP 聊天交互契约', () => {
  test('直接进入 IP 时按姓名、9位营销员编号、主目标、城市顺序收集', async ({ page }) => {
    await enterGuestIp(page);
    await expect(page.locator('#messages')).toContainText('先告诉我你的姓名');
    await page.locator('#chat-input').fill('测试访客');
    await page.locator('#chat-form').getByRole('button', { name: '发送' }).click();
    await expect(page.locator('#messages')).toContainText('9 位营销员编号');
    await expect(page.locator('#messages')).toContainText(/匹配已有资料/);
    await page.locator('#chat-input').fill('12345');
    await page.locator('#chat-form').getByRole('button', { name: '发送' }).click();
    await expect(page.locator('#messages')).toContainText('应为 9 位数字');
    await page.locator('#chat-input').fill('123456789');
    await page.locator('#chat-form').getByRole('button', { name: '发送' }).click();
    await expect(page.locator('#messages')).toContainText(/优先帮你|拓客.*增员/);
    await page.locator('#quick-replies').getByRole('button', { name: '吸引潜在客户', exact: true }).click();
    await expect(page.locator('#messages')).toContainText('请补充你主要服务的城市');
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
    await expect(composer.locator('.composer-editor')).toBeVisible();
    await expect(composer.locator('.composer-editor .composer-selection-chip')).toHaveCount(2);
    await expect(composer.locator('.composer-editor')).toContainText('企业主');
    await expect(composer.locator('.composer-editor')).toContainText('宝爸宝妈');
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

  test('发送多选答案必须进入对话并触发下一题', async ({ page }) => {
    await reachFirstMultiQuestion(page);
    await page.locator('#quick-replies').getByRole('button', { name: '企业主' }).click();
    await page.locator('#quick-replies').getByRole('button', { name: '宝爸宝妈' }).click();
    await page.locator('#chat-form').getByRole('button', { name: '发送' }).click();
    const userMessages = page.locator('#messages .message.user');
    await expect(userMessages.last()).toContainText('企业主');
    await expect(userMessages.last()).toContainText('宝爸宝妈');
    await expect(page.locator('#chat-form .composer-selection-chip')).toHaveCount(0);
    await expect(page.locator('#messages')).toContainText('你的目标客户主要处在哪些年龄段');
  });

  test('多选标签与自由输入必须一次发送到同一条对话消息', async ({ page }) => {
    await reachFirstMultiQuestion(page);
    await page.locator('#quick-replies').getByRole('button', { name: '企业主' }).click();
    await page.locator('#chat-input').fill('医生群体');
    await page.locator('#chat-form').getByRole('button', { name: '发送' }).click();
    const lastUser = page.locator('#messages .message.user').last();
    await expect(lastUser).toContainText('企业主');
    await expect(lastUser).toContainText('医生群体');
    await expect(page.locator('#messages')).toContainText('你的目标客户主要处在哪些年龄段');
  });

  test('发送多选答案后下一题应自动进入可视区域', async ({ page }) => {
    await reachFirstMultiQuestion(page);
    await page.locator('#quick-replies').getByRole('button', { name: '企业主' }).click();
    await page.locator('#quick-replies').getByRole('button', { name: '宝爸宝妈' }).click();
    await page.locator('#chat-form').getByRole('button', { name: '发送' }).click();
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