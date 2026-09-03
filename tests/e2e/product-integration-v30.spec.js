const { test, expect } = require('@playwright/test');

async function enterGuest(page) {
  await page.goto('/');
  await page.getByRole('button', { name: '我不在名单中，直接开始' }).click();
  await expect(page.locator('#workspace')).toBeVisible();
}

const assetPath = (src) => String(src || '').split('?')[0];

test.describe('当前最终产品集成契约', () => {
  test('退役 V30/V31/V33 不进入真实加载链，canonical owners 保持唯一', async ({ page }) => {
    await page.goto('/');
    const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.getAttribute('src')).filter(Boolean));
    const paths = scripts.map(assetPath);
    expect(paths.some((src) => /product-integration-v30|product-integration-v31|product-integration-v33/.test(src))).toBeFalsy();
    expect(paths).toContain('ip-policy-core.js');
    expect(paths).toContain('nickname-policy-v1.js');
    expect(paths).toContain('profile-float.js');
  });

  test('我的资料悬浮入口使用当前唯一 Owner，默认只显示圆形图标', async ({ page }) => {
    await enterGuest(page);
    const profile = page.locator('#aia-ip-owner-profile-button');
    await expect(profile).toBeVisible();
    await expect(profile).toHaveAttribute('aria-label', '我的 IP 资料');
    await expect(profile.locator('.aia-ip-owner-icon')).toBeVisible();
    await expect(profile.locator('.aia-ip-owner-tooltip')).toHaveCSS('opacity', '0');
    const box = await profile.boundingBox();
    expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
    await expect(profile).not.toContainText(/V\d+/);
    await expect(page.locator('#aia-ip-owner-proposal-button')).toBeHidden();
  });

  test('我的资料抽屉可独立打开关闭，不依赖旧 profile-panel', async ({ page }) => {
    await enterGuest(page);
    await page.evaluate(() => {
      state.profile = { name: '王静', agentId: 'A001', city: '成都', primaryGoal: 'customer_acquisition', contentTone: '温暖陪伴' };
      window.aiaFloatingUi.renderProfileDrawer();
      window.aiaFloatingUi.sync();
    });
    await page.locator('#aia-ip-owner-profile-button').click();
    const drawer = page.locator('#aia-ip-owner-profile-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('王静');
    await expect(drawer).toContainText('拓客');
    await expect(drawer).toContainText('温暖陪伴');
    await page.locator('#aia-ip-owner-profile-close').click();
    await expect(drawer).toBeHidden();
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
