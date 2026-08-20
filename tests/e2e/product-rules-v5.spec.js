const { test, expect } = require('@playwright/test');

test.describe('产品规则 V5/V12 兼容回归', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('IP 方案将修改次数限制合并到合规提示板块', async ({ page }) => {
    await page.evaluate(() => {
      renderProposal({
        headline: '测试定位', subheadline: '测试说明', tags: ['专业', '温暖', '真实'],
        clientPortrait: { title: '目标客户画像', text: '测试人群' }, advantages: [], nicknameOptions: [],
        bios: { xiaohongshu: [{ label: '方案 A', focus: '', lines: ['真实分享'] }], videoDouyin: [{ label: '方案 A', focus: '', lines: ['真实分享'] }] },
        platformReminders: ['小红书个人简介：7 天限修改 3 次', '视频号昵称：每年最多可修改 5 次'],
      }, 1);
    });
    await expect(page.locator('#proposal-content .compliance-card')).toContainText('修改次数限制');
    await expect(page.locator('#proposal-content .compliance-reminders-inline')).toContainText('7 天限修改 3 次');
    await expect(page.locator('#proposal-content > .platform-reminders')).toHaveCount(0);
  });

  test('独立内容规划入口已经退出用户工作台', async ({ page }) => {
    await page.getByRole('button', { name: /直接开始/ }).click();
    await expect(page.locator('#tool-tabs [data-tool="planning"]')).toHaveCount(0);
    await expect(page.locator('#planning-panel')).toBeHidden();
    await expect(page.locator('#content-plan-screen')).toBeHidden();
  });

  test('小红书排版优先给关键词加语义表情并保证两句内有视觉锚点', async ({ page }) => {
    await page.evaluate(() => {
      const node = document.createElement('div');
      document.getElementById('xhs-messages').appendChild(node);
      renderCreativeResult(node, 'xhs', {
        formattedText: '育儿是长期课题。升学规划需要提前准备。这句话没有关键词。另一句话也比较普通。骑行让我保持运动习惯。法律常识也值得了解。',
        suggestedTags: [], risks: [],
      });
    });
    const value = await page.locator('#xhs-messages textarea').inputValue();
    expect(value).toMatch(/育儿🧸/);
    expect(value).toMatch(/升学🎓/);
    expect(value).toMatch(/骑行🚴/);
    expect(value).toMatch(/法律⚖️/);
    expect(value).toMatch(/[📌💡✨✅].*这句话没有关键词|这句话没有关键词.*[📌💡✨✅]/s);
  });
});
