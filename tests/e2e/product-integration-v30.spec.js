const { test, expect } = require('@playwright/test');

async function enterGuest(page) {
  await page.goto('/');
  await page.getByRole('button', { name: '我不在名单中，直接开始' }).click();
  await expect(page.locator('#workspace')).toBeVisible();
}

test.describe('V30 最终产品集成契约', () => {
  test('最终集成层必须是页面最后加载的业务脚本', async ({ page }) => {
    await page.goto('/');
    const last = await page.evaluate(() => [...document.scripts].map((s) => s.getAttribute('src')).filter(Boolean).at(-1));
    expect(last).toContain('product-integration-v30.js');
  });

  test('真实悬浮按钮使用两行文字而不是旧表情标题', async ({ page }) => {
    await enterGuest(page);
    const button = page.locator('.ip-floating-profile-button');
    await expect(button).toBeVisible();
    await expect(button.locator('span')).toHaveCount(2);
    await expect(button.locator('span').nth(0)).toHaveText('我的');
    await expect(button.locator('span').nth(1)).toHaveText('资料');
    await expect(button).not.toContainText('✨');
  });

  test('语义预填只补空字段，绝不覆盖营销员已有资料', async ({ page }) => {
    await enterGuest(page);
    const profile = await page.evaluate(() => {
      const p = { city: '成都', hobbies: '' };
      window.aiaProductIntegrationV30.applySemanticUpdates(p, { city: '上海', hobbies: '跑步' });
      return p;
    });
    expect(profile.city).toBe('成都');
    expect(profile.hobbies).toBe('跑步');
  });

  test('旧昵称评估采取保守原则，并参考学历等真实特色', async ({ page }) => {
    await enterGuest(page);
    const result = await page.evaluate(() => window.aiaProductIntegrationV30.evaluateExistingNickname('静姐聊生活', {
      name: '王静', preferredName: '静姐', education: '硕士', schoolTier: '985', city: '成都'
    }));
    expect(result.recommendation).toBe('建议保留');
    expect(result.strengths.join(' ')).toContain('人物称呼');
    expect(result.observations.join(' ')).toContain('学历');
    expect(result.observations.join(' ')).toContain('不代表现有昵称不好');
  });

  test('昵称板块必须明确 AI 推荐仅供参考', async ({ page }) => {
    await enterGuest(page);
    await page.evaluate(() => {
      state.profile = { name: '王静', videoNickname: '静姐聊生活', education: '硕士', schoolTier: '985' };
      const content = document.getElementById('proposal-content');
      content.innerHTML = '<section><h3>推荐昵称</h3><div>静姐说保障</div></section>';
      window.aiaProductIntegrationV30.renderNicknameAdvice();
    });
    await expect(page.locator('.nickname-reference-note')).toContainText('AI 推荐昵称仅供参考');
    await expect(page.locator('.nickname-reference-note')).toContainText('特殊含义');
  });
});
