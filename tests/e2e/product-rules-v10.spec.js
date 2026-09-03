const { test, expect } = require('@playwright/test');

function sampleProposal() {
  return {
    headline: '测试定位', subheadline: '测试说明', tags: ['专业', '温暖', '真实'],
    clientPortrait: { title: '目标客户画像', text: '测试人群' }, advantages: [],
    nicknameOptions: [{ name: '芳姐聊养老', angle: '突出专业', reason: '测试' }],
    bios: {
      xiaohongshu: [{ label: '推荐版', focus: '', lines: ['真实分享', '📌 本账号所述内容为个人意见，不代表任何官方意见。'] }],
      videoDouyin: [{ label: '推荐版', focus: '', lines: ['真实分享', '📌 本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见', '营销服务部：成都一部', '执业证编号：000'] }],
    },
    platformReminders: ['小红书个人简介：7 天内最多修改 3 次，频繁修改也可能影响账号稳定。', '微信视频号昵称：每年最多可修改 5 次。', '微信视频号简介：目前没有明确的修改次数限制。'],
  };
}

async function enterProposal(page, context) {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.evaluate((proposal) => {
    state.profile = { name: '张晓芳', preferredName: '芳姐', department: '成都一部' };
    renderProposal(proposal, 1);
  }, sampleProposal());
}

async function advanceToCompliance(page) {
  const reminder = page.locator('.copy-reminder-backdrop');
  await expect(reminder).toBeVisible();
  await expect(reminder).toContainText('小红书个人简介：7 天内最多修改 3 次');
  await expect(reminder).toContainText('微信视频号昵称：每年最多可修改 5 次');
  await reminder.getByRole('button', { name: '下一步：查看合规' }).click();
  const compliance = page.locator('.copy-reminder-backdrop');
  await expect(compliance).toContainText('可以说');
  await expect(compliance).toContainText('不可以说');
  return compliance;
}

test.describe('当前昵称 / 简介复制合规契约', () => {
  test.beforeEach(async ({ page, context }) => {
    await enterProposal(page, context);
  });

  test('合规说明作为次级帮助，不恢复已经废弃的大块折叠卡', async ({ page }) => {
    await expect(page.locator('.ip-compliance-fold')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '查看昵称合规提示' })).toBeVisible();
    await expect(page.getByRole('button', { name: '查看简介合规提示' })).toBeVisible();
  });

  test('第一次复制昵称先提示固定修改次数，再展示合规，确认后才复制', async ({ page }) => {
    const copy = page.locator('.nickname-option .copy-button').first();
    await copy.click();
    const compliance = await advanceToCompliance(page);
    await expect(compliance).toContainText('昵称合规提示');
    await compliance.getByRole('button', { name: '我已了解，继续复制' }).click();
    await expect(page.locator('.copy-reminder-backdrop')).toHaveCount(0);
    await copy.click();
    await expect(page.locator('.copy-reminder-backdrop')).toHaveCount(0);
  });

  test('第一次复制简介独立执行修改次数提醒和合规提示', async ({ page }) => {
    const nicknameCopy = page.locator('.nickname-option .copy-button').first();
    await nicknameCopy.click();
    let compliance = await advanceToCompliance(page);
    await compliance.getByRole('button', { name: '我已了解，继续复制' }).click();

    const bioCopy = page.locator('.bio-copy-block .copy-button').first();
    await bioCopy.click();
    compliance = await advanceToCompliance(page);
    await expect(compliance).toContainText('简介合规提示');
    await compliance.getByRole('button', { name: '我已了解，继续复制' }).click();
    await expect(page.locator('.copy-reminder-backdrop')).toHaveCount(0);
  });

  test('帮助按钮只展示合规，不触发 Clipboard 写入', async ({ page }) => {
    await page.getByRole('button', { name: '查看简介合规提示' }).click();
    const modal = page.locator('.copy-reminder-backdrop');
    await expect(modal).toContainText('简介合规提示');
    await expect(modal).toContainText('可以说');
    await expect(modal).toContainText('不可以说');
    await modal.getByRole('button', { name: '我知道了' }).click();
    await expect(modal).toHaveCount(0);
  });
});
