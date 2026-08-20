const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, bodyScroll: document.body.scrollWidth }));
  expect(metrics.scroll).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.bodyScroll).toBeLessThanOrEqual(metrics.viewport + 1);
}

test.describe('AIA Auto IP 基础前端验收', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('登录首屏保持聚焦，不展示功能选择卡或红人计划大图', async ({ page }) => {
    await expect(page).toHaveTitle(/AIA Auto IP/);
    await expect(page.locator('.identity-tools')).toHaveCount(0);
    await expect(page.getByRole('img', { name: '红人计划' })).toHaveCount(0);
  });

  test('工作台保留四个正式用户入口且不再展示独立内容规划', async ({ page }) => {
    await page.getByRole('button', { name: /直接开始/ }).click();
    const tabs = page.locator('#tool-tabs');
    await expect(tabs.getByRole('button', { name: /IP 人设/ })).toBeVisible();
    await expect(tabs.getByRole('button', { name: /脚本推荐/ })).toBeVisible();
    await expect(tabs.getByRole('button', { name: /脚本改写/ })).toBeVisible();
    await expect(tabs.getByRole('button', { name: /小红书排版/ })).toBeVisible();
    await expect(tabs.getByRole('button', { name: /内容规划/ })).toHaveCount(0);
    await expect(page.locator('#tool-tabs .tool-tab')).toHaveCount(4);
  });

  test('当前视口不出现非预期横向溢出', async ({ page }) => { await expectNoHorizontalOverflow(page); });

  test('身份输入与主按钮在移动端可达', async ({ page }) => {
    await expect(page.getByLabel('姓名')).toBeVisible();
    await expect(page.getByLabel('营销员编号')).toBeVisible();
    await expect(page.getByRole('button', { name: '匹配我的资料' })).toBeVisible();
  });

  test('不存在 serious / critical 级自动可访问性问题', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    const severe = results.violations.filter((item) => ['serious', 'critical'].includes(item.impact));
    expect(severe, severe.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual([]);
  });
});
