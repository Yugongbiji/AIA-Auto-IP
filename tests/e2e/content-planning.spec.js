const { test, expect } = require('@playwright/test');

const proposal = {
  headline: '懂家庭规划的靠谱搭子', subheadline: '把复杂问题讲清楚', tags: ['家庭', '专业', '骑行'],
  clientPortrait: { title: '目标客户画像', text: '35-45 岁家庭' }, advantages: [], nicknameOptions: [],
  bios: { xiaohongshu: [], videoDouyin: [] }, platformReminders: [],
};

async function renderWith(page, profile) {
  await page.evaluate(({ profile, proposal }) => {
    state.profile = profile;
    renderProposal(proposal, 1);
  }, { profile, proposal });
}

test.describe('内容规划合并到 IP 方案', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('不再存在独立内容规划入口，purpose 直接包含拓客和增员都要', async ({ page }) => {
    await page.getByRole('button', { name: /直接开始/ }).click();
    await expect(page.locator('#tool-tabs [data-tool="planning"]')).toHaveCount(0);
    const purpose = await page.evaluate(() => questions.find((item) => item.key === 'purpose'));
    expect(purpose.chips).toEqual(['拓客', '增员', '拓客和增员都要', '打造个人品牌']);
  });

  test('拓客只展示保险专业主线和泛内容支线', async ({ page }) => {
    await renderWith(page, { purpose: '拓客', customerGroups: '宝爸宝妈', selfIntro: '平时喜欢骑行' });
    const root = page.locator('.ip-content-strategy');
    await expect(root).toContainText('你的内容主线');
    await expect(root).toContainText('保险专业主线');
    await expect(root).toContainText('泛内容支线 · 骑行');
    await expect(root).not.toContainText('增员内容主线');
    await expect(root).toContainText('建立信任');
    await expect(root).toContainText('扩大受众');
  });

  test('增员只展示增员内容主线，不把保险科普混入增员方向', async ({ page }) => {
    await renderWith(page, { purpose: '增员', selfIntro: '从互联网转型保险，现在负责团队带教' });
    const root = page.locator('.ip-content-strategy');
    await expect(root).toContainText('增员内容主线');
    await expect(root).not.toContainText('保险专业主线');
    await expect(root.locator('.ip-strategy-recruitment')).toContainText('转型经历');
    await expect(root.locator('.ip-strategy-recruitment')).not.toContainText('保险科普');
  });

  test('拓客和增员都要时同时展示两条专业主线', async ({ page }) => {
    await renderWith(page, { purpose: '拓客和增员都要', selfIntro: '长期做户外运动' });
    const root = page.locator('.ip-content-strategy');
    await expect(root).toContainText('拓客内容主线');
    await expect(root).toContainText('增员内容主线');
    await expect(root).toContainText('泛内容支线 · 户外');
    await expect(root).toContainText('同一阶段要有明显主次');
  });

  test('没有真实泛内容证据时不猜，显示暂未确定', async ({ page }) => {
    await renderWith(page, { purpose: '拓客', strengths: ['专业靠谱'], customerGroups: ['企业主'] });
    const general = page.locator('.ip-strategy-general');
    await expect(general).toContainText('暂未确定');
    await expect(general).toContainText('真正长期在做');
  });

  test('合集名称全部不超过 5 个字', async ({ page }) => {
    await renderWith(page, { purpose: '拓客和增员都要', selfIntro: '喜欢骑行，也有转型经历', customerGroups: '宝爸宝妈' });
    const names = await page.locator('.strategy-collection-chip').allTextContents();
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(Array.from(name).length, `${name} 超过5个字`).toBeLessThanOrEqual(5);
  });

  test('旧候选和不建议方向不再进入新的 IP 内容主线', async ({ page }) => {
    await renderWith(page, { purpose: '拓客', selfIntro: '喜欢读书' });
    const root = page.locator('.ip-content-strategy');
    await expect(root).not.toContainText('候选方向');
    await expect(root).not.toContainText('不建议混入');
    await expect(page.locator('#content-plan-screen')).toBeHidden();
  });
});
