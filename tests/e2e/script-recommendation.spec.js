const { test, expect } = require('@playwright/test');

test.describe('脚本推荐 V1', () => {
  test('读取 IP 内容方向并可从详情一键带入脚本改写', async ({ page }) => {
    let requestedDirections = [];
    const activityEvents = [];

    await page.route('**/api/scripts/recommend', async (route) => {
      requestedDirections = route.request().postDataJSON().contentDirections || [];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true,
        recommendation_batch: 'rec-e2e',
        groups: [{
          content_direction: '养老规划',
          reason: '和你的「养老规划」内容主线匹配',
          scripts: [{
            script_id: 101, title: '养老政策最近有什么变化', level1_tag: '养老', level2_tag: '政策',
            word_count: 486, estimated_minutes: 1.9, is_hot: true,
          }],
        }],
      }) });
    });
    await page.route('**/api/scripts/101', async (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true,
        script: {
          script_id: 101, title_1: '养老政策最近有什么变化', title_2: null, title_3: null,
          body: '这是完整脚本正文。', level1_tag: '养老', level2_tag: '政策',
          word_count: 486, estimated_minutes: 1.9, is_hot: true,
        },
      }),
    }));
    await page.route('**/api/scripts/activity', async (route) => {
      activityEvents.push(route.request().postDataJSON().eventType);
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.route('**/api/lookup**', async (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ matched: false, profile: {}, history: [], proposals: [], planningHistory: [], contentPlans: [], creativeHistory: [] }),
    }));

    await page.goto('/');
    await page.getByRole('button', { name: '我不在名单中，直接开始' }).click();
    await page.evaluate(() => {
      state.profile = { purpose: '拓客', customerGroups: ['宝爸宝妈'], selfIntro: '长期关注养老规划' };
      state.proposals = [{ proposal: { headline: '家庭规划顾问', subheadline: '把复杂问题讲清楚', tags: ['养老', '家庭', '专业'], advantages: [] } }];
    });

    await page.locator('#tool-tabs').getByRole('button', { name: /脚本推荐/ }).click();
    await expect(page.locator('#script-recommendation-panel')).toBeVisible();
    await expect(page.locator('.script-direction-section')).toContainText('养老规划');
    await expect(page.locator('.script-hot-badge')).toHaveText('热点');
    await expect(page.locator('.script-card-meta')).toHaveText('养老 · 政策 · 486字 · 1.9min');
    expect(requestedDirections).toContain('养老规划');

    await page.getByRole('button', { name: '养老政策最近有什么变化' }).click();
    await expect(page.locator('#script-detail-screen')).toBeVisible();
    await expect(page.locator('#script-detail-body')).toContainText('这是完整脚本正文。');
    await expect(page.getByRole('button', { name: '脚本改写' })).toBeVisible();
    await expect(page.getByRole('button', { name: '小红书排版' })).toBeVisible();

    await page.locator('#script-detail-rewrite').click();
    await expect(page.locator('#script-panel')).toBeVisible();
    await expect(page.locator('#script-recommendation-panel')).toBeHidden();
    await expect(page.locator('#script-input')).toHaveValue('养老政策最近有什么变化\n这是完整脚本正文。');

    await expect.poll(() => activityEvents).toContain('impression');
    await expect.poll(() => activityEvents).toContain('detail_click');
    await expect.poll(() => activityEvents).toContain('rewrite_click');
  });
});
