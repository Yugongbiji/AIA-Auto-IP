const { test, expect } = require('@playwright/test');

async function enterGuest(page) {
  await page.goto('/');
  await page.getByRole('button', { name: /直接开始/ }).click();
  await expect(page.locator('#workspace')).toBeVisible();
}

test.describe('当前内容方向与目标合同', () => {
  test('独立内容规划入口退役，业务目标只能拓客/增员二选一', async ({ page }) => {
    await enterGuest(page);
    await expect(page.locator('#tool-tabs [data-tool="planning"]')).toHaveCount(0);
    const goal = await page.evaluate(() => questions.find((item) => item.key === 'primaryGoal'));
    expect(goal).toBeTruthy();
    expect(goal.chips).toEqual(['吸引潜在客户', '吸引潜在增员对象']);
    expect(goal.chips.join('')).not.toContain('两者');
    expect(goal.chips.join('')).not.toContain('个人品牌');
  });

  test('模糊报名目的不会自动成为最终目标', async ({ page }) => {
    await enterGuest(page);
    const result = await page.evaluate(() => ({
      both: window.aiaIpPolicy.inferPrimaryGoal({ purpose: '拓客和增员都要' }),
      brand: window.aiaIpPolicy.inferPrimaryGoal({ purpose: '打造专业形象' }),
      customer: window.aiaIpPolicy.inferPrimaryGoal({ purpose: '拓客' }),
      recruit: window.aiaIpPolicy.inferPrimaryGoal({ purpose: '增员' }),
    }));
    expect(result.both).toBe('');
    expect(result.brand).toBe('');
    expect(result.customer).toBe('customer_acquisition');
    expect(result.recruit).toBe('recruitment');
  });

  test('增员路径切换为准增员对象语义且年龄没有55岁以上', async ({ page }) => {
    await enterGuest(page);
    const result = await page.evaluate(() => {
      const p = { primaryGoal: 'recruitment' };
      window.aiaIpPolicy.prepareProfileGoal(p);
      const groups = questions.find((q) => q.key === 'recruitmentGroups');
      const ages = questions.find((q) => q.key === 'recruitmentAges');
      return { groups, ages };
    });
    expect(result.groups.label).toBe('准增员对象');
    expect(result.ages.label).toBe('准增员年龄段');
    expect(result.ages.chips.join('')).not.toContain('55');
  });

  test('生活兴趣只能进入内容支线，不能进入保险主线', async ({ page }) => {
    await enterGuest(page);
    const result = await page.evaluate(() => {
      const profile = { primaryGoal: 'customer_acquisition', hobbies: '健康养生｜育儿｜旅行' };
      const proposal = {};
      window.aiaIpPolicy.enforceProposal(proposal, profile);
      return proposal;
    });
    expect(result.contentMainline.join(' ')).not.toMatch(/健康养生|育儿|旅行/);
    expect(result.secondaryContent.length).toBeLessThanOrEqual(1);
  });

  test('增员方案的人群画像与主线都使用增员语义', async ({ page }) => {
    await enterGuest(page);
    const result = await page.evaluate(() => {
      const profile = { primaryGoal: 'recruitment', recruitmentGroups: '职场白领｜创业者/企业主', recruitmentAges: '30–40 岁', previousCareer: '互联网/科技' };
      const proposal = {};
      window.aiaIpPolicy.enforceProposal(proposal, profile);
      return proposal;
    });
    expect(result.clientPortrait.title).toContain('准增员');
    expect(result.clientPortrait.text).toContain('职场白领');
    expect(result.contentMainline).toEqual(['增员与职业发展']);
  });

  test('内容支线使用同一排序源且只保留一个最终方向', async ({ page }) => {
    await enterGuest(page);
    const result = await page.evaluate(() => {
      const profile = { primaryGoal: 'customer_acquisition', lifeRoles: '宝妈', hobbies: '美食', selfIntro: '两个孩子的妈妈，平时也喜欢做饭' };
      const ranked = window.rankIpContentBranches(profile);
      const proposal = {};
      window.aiaIpPolicy.enforceProposal(proposal, profile);
      return { ranked, secondary: proposal.secondaryContent };
    });
    expect(result.ranked.length).toBeGreaterThan(0);
    expect(result.secondary).toHaveLength(1);
    expect(result.secondary[0]).toBe(result.ranked[0].direction);
  });
});
