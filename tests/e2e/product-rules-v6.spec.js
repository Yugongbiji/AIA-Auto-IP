const { test, expect } = require('@playwright/test');

test.describe('产品规则 V6 对话体验层回归', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('页面加载 V6 对话装饰脚本，允许带缓存版本参数', async ({ page }) => {
    await expect(page.locator('script[src^="product-rules-v6.js"]')).toHaveCount(1);
  });

  test('V6 只负责对话 Emoji，不拥有昵称、简介或创作 loading', async ({ page }) => {
    const ownership = await page.evaluate(() => ({
      loaded: Boolean(window.aiaDialogueDecorationV6),
      ownsNickname: window.aiaDialogueDecorationV6?.ownsNickname,
      ownsBio: window.aiaDialogueDecorationV6?.ownsBio,
      ownsCreativeStatus: window.aiaDialogueDecorationV6?.ownsCreativeStatus,
      canonicalIpOwner: Boolean(window.aiaIpPolicy),
      canonicalNicknameOwner: Boolean(window.aiaNicknamePolicyV1),
    }));
    expect(ownership).toEqual({
      loaded: true,
      ownsNickname: false,
      ownsBio: false,
      ownsCreativeStatus: false,
      canonicalIpOwner: true,
      canonicalNicknameOwner: true,
    });
  });

  test('普通助手对话可适量增加语义表情且不修改用户消息', async ({ page }) => {
    await page.evaluate(() => {
      addMessage('接下来继续补充资料，我们很快就能生成方案。', 'assistant', false);
      addMessage('这是我自己的回答', 'user', false);
    });
    const assistant = page.locator('#messages .message.assistant').last();
    await expect(assistant).toContainText(/[📋✨💡📌✅🧭🙂]/);
    await expect(page.locator('#messages .message.user').last()).toHaveText('这是我自己的回答');
  });
});