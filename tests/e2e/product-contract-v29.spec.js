const { test, expect } = require('@playwright/test');

async function enterGuest(page) {
  await page.goto('/');
  await page.getByRole('button', { name: '我不在名单中，直接开始' }).click();
  await expect(page.locator('#workspace')).toBeVisible();
}

test.describe('V29 最终渲染契约', () => {
  test('客户反馈必须是独立板块，旧单字段不得残留', async ({ page }) => {
    await enterGuest(page);
    await page.evaluate(() => {
      state.profile.peerReviewKeywords = '常用称呼：静姐×5；高频印象：靠谱';
      state.profile.peerReviewSummary = {
        reviewCount: 5,
        topNicknames: [{ label: '静姐', count: 5 }],
        relationships: [{ label: '客户', count: 4 }],
        topTraits: [{ label: '靠谱', count: 5 }],
        topTopics: [{ label: '养老', count: 3 }],
        topRoles: [{ label: '专业顾问', count: 4 }],
        representativeQuotes: ['很靠谱，也很耐心。'],
      };
      renderProfile();
    });
    await expect(page.locator('[data-peer-feedback="1"]')).toBeVisible();
    await expect(page.locator('[data-peer-feedback="1"]')).toContainText('大家怎么称呼我');
    await expect(page.locator('[data-peer-feedback="1"]')).toContainText('他们眼中的我');
    await expect(page.locator('[data-profile-peer-review="1"]')).toHaveCount(0);
  });

  test('现有昵称建议放在推荐昵称板块正上方，通用昵称原则属于整个板块', async ({ page }) => {
    await enterGuest(page);
    await page.evaluate(() => {
      state.profile.name = '王静';
      state.profile.videoNickname = '静姐说保障';
      state.profile.xiaohongshuNickname = '静姐说保障';
      state.profile.peerReviewSummary = { topNicknames: [{ label: '静姐', count: 5 }] };
      const content = document.getElementById('proposal-content');
      content.innerHTML = '<section id="headline"><h2>一句话定位</h2></section><section id="nick"><h2>推荐昵称</h2><div>候选昵称</div></section><section><h2>平台简介</h2></section>';
      window.aiaProductRulesV29.renderNicknameAuditInPlace();
    });
    const audit = page.locator('.nickname-audit-card');
    await expect(audit).toBeVisible();
    await expect(audit).not.toContainText('缺少可识别的文字主体');
    await expect(page.locator('.nickname-general-note')).toContainText('一个昵称只保留一个称呼主体');
    const order = await page.evaluate(() => {
      const audit = document.querySelector('.nickname-audit-card');
      const nick = document.getElementById('nick');
      return audit.nextElementSibling === nick;
    });
    expect(order).toBeTruthy();
  });

  test('双称呼昵称用人话指出问题', async ({ page }) => {
    await enterGuest(page);
    const result = await page.evaluate(() => window.aiaProductRulesV29.evaluateNickname('静姐说保障静静', {
      name: '王静', peerReviewSummary: { topNicknames: [{ label: '静姐', count: 3 }, { label: '静静', count: 5 }] },
    }));
    expect(result.issues.join('')).toContain('两个称呼');
    expect(result.issues.join('')).not.toContain('文字主体');
  });
});
