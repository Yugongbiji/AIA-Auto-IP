const { test, expect } = require('@playwright/test');

test.describe('简介合规输出顺序', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('小红书合规声明固定为最后一句', async ({ page }) => {
    const text = await page.evaluate(() => {
      const parent = document.createElement('div');
      document.body.appendChild(parent);
      addCopyBlock(parent, {
        label: '测试简介',
        lines: ['第一句', '本账号所述内容为个人意见，不代表任何官方意见。', '第二句'],
      }, '小红书');
      return parent.querySelector('textarea').value;
    });
    const lines = text.split('\n');
    expect(lines.at(-1)).toBe('本账号所述内容为个人意见，不代表任何官方意见。');
    expect(lines.filter((line) => line.includes('本账号所述内容为个人意见')).length).toBe(1);
  });

  test('视频号抖音末尾三项连续且顺序固定，不使用营销员编号代替执业证编号', async ({ page }) => {
    const text = await page.evaluate(() => {
      state.profile.department = '成都一部';
      state.profile.agentId = '123456789';
      const parent = document.createElement('div');
      document.body.appendChild(parent);
      addCopyBlock(parent, {
        label: '测试简介',
        lines: [
          '第一句',
          '营销服务部：旧部门',
          '执业证编号：123456789',
          '本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见',
          '第二句',
        ],
      }, '视频号 / 抖音');
      return parent.querySelector('textarea').value;
    });
    const lines = text.split('\n');
    expect(lines.slice(-3)).toEqual([
      '本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见',
      '营销服务部：成都一部',
      '执业证编号：000',
    ]);
    expect(text).not.toContain('执业证编号：123456789');
  });
});
