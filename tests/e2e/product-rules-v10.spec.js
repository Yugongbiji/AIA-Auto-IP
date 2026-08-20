const { test, expect } = require('@playwright/test');

function sampleProposal() {
  return {
    headline: '测试定位', subheadline: '测试说明', tags: ['专业', '温暖', '真实'],
    clientPortrait: { title: '目标客户画像', text: '测试人群' }, advantages: [],
    nicknameOptions: [{ name: '芳姐聊养老', angle: '突出专业', reason: '测试' }],
    bios: {
      xiaohongshu: [{ label: '方案 A', focus: '', lines: ['真实分享', '📌 本账号所述内容为个人意见，不代表任何官方意见。'] }],
      videoDouyin: [{ label: '方案 A', focus: '', lines: ['真实分享', '📌 本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见', '营销服务部：成都一部', '执业证编号：000'] }],
    },
    platformReminders: ['小红书个人简介：7 天限修改 3 次（频繁修改影响账号权重）', '视频号昵称：每年最多可修改 5 次', '微信视频号简介：暂无明确修改次数限制'],
  };
}

test.describe('产品规则 V10 回归', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await page.evaluate((proposal) => {
      state.profile = { name: '张晓芳', preferredName: '芳姐', department: '成都一部' };
      renderProposal(proposal, 1);
    }, sampleProposal());
  });

  test('合规与修改提醒默认折叠，不再占据大块空间', async ({ page }) => {
    const fold = page.locator('.ip-compliance-fold');
    await expect(fold).toHaveCount(1);
    await expect(fold).not.toHaveAttribute('open', '');
    await expect(fold.locator('summary')).toContainText('合规与修改提醒');
    await expect(fold.locator('.compliance-card')).toHaveCount(1);
    await expect(fold.locator('.platform-reminders')).toHaveCount(1);
  });

  test('第一次复制昵称弹提醒，确认后后续昵称复制不重复弹', async ({ page }) => {
    const copy = page.locator('.nickname-option .copy-button').first();
    await copy.click();
    const modal = page.locator('.copy-reminder-backdrop');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('微信视频号昵称：每年最多可修改 5 次');
    await modal.getByRole('button', { name: '知道了，继续复制' }).click();
    await expect(modal).toHaveCount(0);
    await copy.click();
    await expect(page.locator('.copy-reminder-backdrop')).toHaveCount(0);
  });

  test('第一次复制简介独立弹提醒，昵称提醒不能替代简介提醒', async ({ page }) => {
    const nicknameCopy = page.locator('.nickname-option .copy-button').first();
    await nicknameCopy.click();
    await page.getByRole('button', { name: '知道了，继续复制' }).click();

    const bioCopy = page.locator('.bio-copy-block .copy-button').first();
    await bioCopy.click();
    const modal = page.locator('.copy-reminder-backdrop');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('小红书个人简介：7 天内最多修改 3 次');
  });

  test('取消首次复制后，下次仍应再次提醒', async ({ page }) => {
    const bioCopy = page.locator('.bio-copy-block .copy-button').first();
    await bioCopy.click();
    await page.getByRole('button', { name: '先不复制' }).click();
    await expect(page.locator('.copy-reminder-backdrop')).toHaveCount(0);
    await bioCopy.click();
    await expect(page.locator('.copy-reminder-backdrop')).toBeVisible();
  });
});
