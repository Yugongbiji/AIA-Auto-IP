const { test, expect } = require('@playwright/test');

async function enterGuest(page) {
  await page.goto('/');
  await page.getByRole('button', { name: '我不在名单中，直接开始' }).click();
  await expect(page.locator('#workspace')).toBeVisible();
}

test.describe('当前最终产品集成契约', () => {
  test('退役 V30/V31/V33 不进入真实加载链', async ({ page }) => {
    await page.goto('/');
    const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.getAttribute('src')).filter(Boolean));
    expect(scripts.some((src) => /product-integration-v30|product-integration-v31|product-integration-v33/.test(src))).toBeFalsy();
    expect(scripts).toContain('ip-policy-core.js');
    expect(scripts).toContain('nickname-policy-v1.js');
  });

  test('两个悬浮入口为纯图标，不显示文字或版本号', async ({ page }) => {
    await enterGuest(page);
    const profile = page.locator('.ip-floating-profile-button');
    await expect(profile).toBeVisible();
    await expect(profile.locator('svg')).toHaveCount(1);
    await expect(profile.locator('span')).toHaveCount(0);
    await expect(profile).not.toContainText('我的');
    await expect(profile).not.toContainText(/V\d+/);
  });

  test('语义资料 Owner 只补空字段，保留已有真实资料', async ({ page }) => {
    await enterGuest(page);
    const profile = await page.evaluate(() => {
      const p = { city: '成都', selfIntro: '以前做教师，平时跑马拉松。', previousCareer: '', hobbies: '' };
      window.aiaProfileRulesV27.extractFactsFromIntro(p);
      return p;
    });
    expect(profile.city).toBe('成都');
    expect(profile.previousCareer).toContain('教育/教师');
    expect(profile.hobbies).toContain('跑步');
  });

  test('昵称规则优先真实人物称呼，不凭学历层级推断学校', async ({ page }) => {
    await enterGuest(page);
    const result = await page.evaluate(() => window.aiaNicknamePolicyV1.controlledOptions({
      name: '王静', schoolTier: 'QS 前 100',
      peerReviewSummary: { topNicknames: [{ label: '静姐', count: 5 }] },
    }));
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toContain('静姐');
    expect(result.map((x) => x.name).join(' ')).not.toMatch(/大学|学院|University/i);
  });

  test('昵称板块继续明确 AI 推荐仅供参考', async ({ page }) => {
    await enterGuest(page);
    await page.evaluate(() => {
      state.profile = { name: '王静', videoNickname: '静姐聊生活', xiaohongshuNickname: '静姐聊生活' };
      const content = document.getElementById('proposal-content');
      content.innerHTML = '<section id="nick"><h3>推荐昵称</h3><div>静姐聊生活</div></section>';
      window.aiaProductRulesV29.renderNicknameAuditInPlace();
    });
    await expect(page.locator('.nickname-general-note')).toContainText('AI 推荐昵称仅供参考');
    await expect(page.locator('.nickname-general-note')).toContainText('特殊含义');
  });
});
