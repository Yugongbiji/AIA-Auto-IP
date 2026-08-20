const { test, expect } = require('@playwright/test');

test.describe('产品规则 V6 回归', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('页面必须加载 V6 产品规则', async ({ page }) => {
    await expect(page.locator('script[src="product-rules-v6.js"]')).toHaveCount(1);
  });

  test('昵称优先使用日常称呼，不直接使用完整姓名', async ({ page }) => {
    await page.evaluate(() => {
      state.profile = {
        name: '张晓芳', preferredName: '芳姐', department: '成都一部',
        strengths: ['养老规划', '保障规划'],
      };
      renderProposal({
        headline: '测试定位', subheadline: '测试说明', tags: ['专业', '温暖', '真实'],
        clientPortrait: { title: '目标客户画像', text: '测试人群' }, advantages: [],
        nicknameOptions: [
          { name: '张晓芳聊养老', angle: '突出专业', reason: '测试' },
          { name: '养老生活笔记', angle: '突出专业', reason: '测试' },
        ],
        bios: {
          xiaohongshu: [{ label: '方案 A', focus: '', lines: ['真实分享'] }],
          videoDouyin: [{ label: '方案 A', focus: '', lines: ['真实分享'] }],
        },
        platformReminders: [],
      }, 1);
    });
    const content = page.locator('#proposal-content');
    await expect(content).toContainText('芳姐聊养老');
    await expect(content).not.toContainText('张晓芳聊养老');
  });

  test('服务能力型简介只使用已确认服务并用竖线分隔', async ({ page }) => {
    await page.evaluate(() => {
      state.profile = {
        name: '张晓芳', preferredName: '芳姐', department: '成都一部',
        strengths: ['养老规划', '保障规划', '专业靠谱'],
      };
      renderProposal({
        headline: '测试定位', subheadline: '测试说明', tags: ['专业', '温暖', '真实'],
        clientPortrait: { title: '目标客户画像', text: '测试人群' }, advantages: [], nicknameOptions: [],
        bios: {
          xiaohongshu: [{ label: '方案 A', focus: '', lines: ['真实分享'] }],
          videoDouyin: [{ label: '方案 A', focus: '', lines: ['真实分享'] }],
        },
        platformReminders: [],
      }, 1);
    });
    const content = page.locator('#proposal-content');
    await expect(content).toContainText('方案 C · 服务能力');
    const bioValues = await content.locator('textarea').evaluateAll((nodes) => nodes.map((node) => node.value));
    expect(bioValues.some((value) => value.includes('芳姐｜养老规划｜保障规划'))).toBeTruthy();
    expect(bioValues.some((value) => value.includes('专业靠谱｜'))).toBeFalsy();
  });

  test('内容规划结果不展示不建议混入方向', async ({ page }) => {
    await page.evaluate(() => {
      renderContentPlan({
        summary: '测试规划', primaryGoal: '拓客为主',
        insuranceLine: { title: '家庭保障', reason: '专业主线' },
        candidateDirections: [{ direction: '育儿', audienceFit: '匹配', sustainable: '可持续', benefit: '利他', recommend: true }],
        finalPositioning: { label: '育儿', explanation: '最终选择' },
        contentDirections: [],
        avoidDirections: [{ direction: '足球运动', reason: '不建议混入' }],
        focusReminder: '保持聚焦',
      }, 1);
    });
    const content = page.locator('#content-plan-content');
    await expect(content).not.toContainText('不建议混入的方向');
    await expect(content).not.toContainText('足球运动');
  });

  test('普通助手对话可适量增加语义表情且不修改用户消息', async ({ page }) => {
    await page.evaluate(() => {
      addMessage('接下来继续补充资料，我们很快就能生成方案。', 'assistant', false);
      addMessage('这是我自己的回答', 'user', false);
    });
    const assistant = page.locator('#messages .message.assistant').last();
    await expect(assistant).toContainText(/[📋✨💡📌✅🧭🙂]/);
    await expect(page.locator('#messages .message.user').last()).toHaveText('这是我自己的回答');
  });
});
