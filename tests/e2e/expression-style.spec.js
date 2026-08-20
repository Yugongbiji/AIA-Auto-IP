const { test, expect } = require('@playwright/test');

test.describe('账号表达风格', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('页面加载 V11 表达风格规则', async ({ page }) => {
    await expect(page.locator('script[src="product-rules-v11.js"]')).toHaveCount(1);
  });

  test('contentTone 改为账号表达风格并支持多选', async ({ page }) => {
    const style = await page.evaluate(() => {
      const question = questions.find((item) => item.key === 'contentTone');
      return { label: labels.contentTone, ask: question.ask, chips: question.chips, multiple: question.multiple };
    });
    expect(style.label).toBe('账号表达风格');
    expect(style.ask).toContain('内容说起话来是什么感觉');
    expect(style.ask).toContain('1～2 个');
    expect(style.multiple).toBe(true);
    expect(style.chips).toEqual(expect.arrayContaining(['专业理性', '亲和温暖', '风趣幽默', '干练直接', '生活化真诚', '观点鲜明', '沉稳可信', '轻松有梗']));
  });

  test('脚本改写前把已选风格转换为明确写作指令', async ({ page }) => {
    await page.evaluate(() => {
      window.fetch = () => new Promise(() => {});
      state.profile = { contentTone: '风趣幽默、专业理性' };
      runScriptRewrite('这是一段用于测试的原稿。');
    });
    const guide = await page.evaluate(() => state.profile.scriptStyleGuide);
    expect(guide).toContain('风趣幽默');
    expect(guide).toContain('轻巧比喻');
    expect(guide).toContain('专业理性');
    expect(guide).toContain('事实、数字、产品责任、核心观点');
  });

  test('没有确认表达风格时不生成内部风格指令', async ({ page }) => {
    await page.evaluate(() => {
      window.fetch = () => new Promise(() => {});
      state.profile = {};
      runScriptRewrite('这是一段用于测试的原稿。');
    });
    expect(await page.evaluate(() => state.profile.scriptStyleGuide || '')).toBe('');
  });
});
