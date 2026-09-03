const { test, expect } = require('@playwright/test');

const XHS_DISCLAIMER = '本账号所述内容为个人意见，不代表任何官方意见。';
const VIDEO_DISCLAIMER = '本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见';

test.describe('简介合规输出顺序', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('小红书 canonical 简介固定以唯一合规声明收尾', async ({ page }) => {
    const lines = await page.evaluate(() => {
      const profile = {
        name: '测试用户', primaryGoal: 'customer_acquisition', city: '成都', insuranceYears: '8年',
        strengths: ['靠谱'], services: ['保障规划'], contentTone: '生活化真诚', department: '成都一部',
      };
      return window.aiaIpPolicy.buildBios(profile, 'xhs', '把复杂选择讲清楚')[0].lines;
    });
    expect(lines.at(-1)).toBe(XHS_DISCLAIMER);
    expect(lines.filter((line) => line === XHS_DISCLAIMER)).toHaveLength(1);
  });

  test('视频号抖音 canonical 尾部三行连续固定，营销员编号不得冒充执业证编号', async ({ page }) => {
    const result = await page.evaluate(() => {
      const profile = {
        name: '测试用户', agentId: '123456789', primaryGoal: 'customer_acquisition', city: '成都', insuranceYears: '8年',
        strengths: ['靠谱'], services: ['保障规划'], contentTone: '生活化真诚', department: '成都一部',
      };
      const lines = window.aiaIpPolicy.buildBios(profile, 'video', '把复杂保障讲清楚')[0].lines;
      return { lines, footer: window.aiaIpPolicy.complianceFooter(profile, 'video') };
    });
    expect(result.lines.slice(-3)).toEqual([
      VIDEO_DISCLAIMER,
      '营销服务部：成都一部',
      '执业证编号：待补充',
    ]);
    expect(result.footer).toEqual(result.lines.slice(-3));
    expect(result.lines.join('\n')).not.toContain('执业证编号：123456789');
  });

  test('有明确执业证编号时只使用真实执业证字段', async ({ page }) => {
    const footer = await page.evaluate(() => window.aiaIpPolicy.complianceFooter({
      agentId: '123456789', department: '成都一部', licenseNumber: 'LIC-2026-001',
    }, 'video'));
    expect(footer).toEqual([
      VIDEO_DISCLAIMER,
      '营销服务部：成都一部',
      '执业证编号：LIC-2026-001',
    ]);
  });
});