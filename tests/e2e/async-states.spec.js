const { test, expect } = require('@playwright/test');

async function enterGuestTool(page, toolName) {
  await page.goto('/');
  await page.getByRole('button', { name: '我不在名单中，直接开始' }).click();
  await expect(page.locator('#workspace')).toBeVisible();
  await page.locator('#tool-tabs').getByRole('button', { name: new RegExp(toolName) }).click();
}

test.describe('异步与空状态', () => {
  test('脚本改写空状态提供明确开始方式', async ({ page }) => {
    await enterGuestTool(page, '脚本改写');
    await expect(page.locator('#script-panel')).toBeVisible();
    await expect(page.locator('#script-messages')).toContainText('知识库锁定');
    await expect(page.locator('#script-messages')).toContainText('把原脚本粘贴在下方');
    await expect(page.locator('#script-input')).toBeVisible();
    await expect(page.locator('#script-form').getByRole('button', { name: '开始改写' })).toBeVisible();
  });

  test('AI 响应慢时必须持续显示统一 loading 反馈', async ({ page }) => {
    await page.route('**/api/script/rewrite', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: '测试超时后的失败' }) });
    });

    await enterGuestTool(page, '脚本改写');
    await page.locator('#script-input').fill('这是一段用于测试慢响应状态的原始脚本，内容足够长，确保进入正常改写流程。');
    await page.locator('#script-form').getByRole('button', { name: '开始改写' }).click();

    await expect(page.locator('#script-save-state')).toHaveText('正在改写…');
    await expect(page.locator('#script-messages')).toContainText('正在改写，请稍候…');
    await expect(page.locator('#script-messages')).toContainText('改写失败：测试超时后的失败', { timeout: 4000 });
    await expect(page.locator('#script-save-state')).toHaveText('本次会话');
  });

  test('接口失败时显示公共 error state，并提供可执行重试', async ({ page }) => {
    let attempts = 0;
    await page.route('**/api/xhs/format', async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '服务暂时不可用' }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          formatted: '重试成功后的排版结果',
          risks: [],
          model: 'mock-model'
        })
      });
    });

    await enterGuestTool(page, '小红书排版');
    await expect(page.locator('#xhs-messages')).toContainText('原文零改动');
    await page.locator('#xhs-input').fill('这是一段用于测试错误状态的小红书原文，系统只应该排版，不应该改动文字。');
    await page.locator('#xhs-form').getByRole('button', { name: '开始排版' }).click();

    await expect(page.locator('#xhs-messages')).toContainText('排版失败：服务暂时不可用');
    await expect(page.locator('#xhs-save-state')).toHaveText('本次会话');
    const retry = page.locator('#xhs-messages').getByRole('button', { name: '重试' });
    await expect(retry).toBeVisible();
    await retry.click();

    // 验证用户可感知的真实完成态和第二次业务请求，而不是绑定某个 mock 字段如何渲染。
    await expect(page.locator('#xhs-messages')).toContainText('小红书排版完成');
    await expect(page.locator('#xhs-save-state')).toHaveText('本次会话');
    await expect(retry).toBeHidden();
    expect(attempts).toBe(2);
  });
});