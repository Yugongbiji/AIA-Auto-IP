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
    expect(style.chips).toEqual(expect.arrayContaining(['专业理性', '亲和温暖', '风趣幽默', '干练直接', '自然真实', '观点鲜明', '沉稳可信', '犀利敢说']));
    expect(style.chips).not.toContain('生活化真诚');
    expect(style.chips).not.toContain('轻松有梗');
  });

  test('普通题材正常带入已选表达风格', async ({ page }) => {
    await page.evaluate(() => {
      window.fetch = () => new Promise(() => {});
      state.profile = { contentTone: '风趣幽默、专业理性' };
      runScriptRewrite('今天聊聊骑行为什么让我更愿意坚持运动。');
    });
    const guide = await page.evaluate(() => state.profile.scriptStyleGuide);
    expect(guide).toContain('风趣幽默');
    expect(guide).toContain('轻巧比喻');
    expect(guide).toContain('专业理性');
    expect(guide).toContain('普通或轻话题');
  });

  test('高敏感悲伤题材自动关闭幽默和玩梗', async ({ page }) => {
    await page.evaluate(() => {
      window.fetch = () => new Promise(() => {});
      state.profile = { contentTone: '风趣幽默、犀利敢说' };
      runScriptRewrite('一场严重车祸后，当事人抢救无效去世，家属随后遇到理赔纠纷。');
    });
    const result = await page.evaluate(() => ({
      guide: state.profile.scriptStyleGuide,
      topic: state.profile.scriptTopicType,
    }));
    expect(result.topic).toBe('high-sensitive');
    expect(result.guide).toContain('高敏感或悲伤题材');
    expect(result.guide).toContain('关闭笑点、段子、俏皮话、网络梗');
    expect(result.guide).toContain('不拿死亡、疾病、事故或赔付结果制造娱乐效果');
  });

  test('专业严肃题材降低幽默和犀利强度', async ({ page }) => {
    await page.evaluate(() => {
      window.fetch = () => new Promise(() => {});
      state.profile = { contentTone: '风趣幽默、犀利敢说' };
      runScriptRewrite('这期解释医疗险的免责条款、保险责任和理赔条件。');
    });
    const result = await page.evaluate(() => ({
      guide: state.profile.scriptStyleGuide,
      topic: state.profile.scriptTopicType,
    }));
    expect(result.topic).toBe('professional-serious');
    expect(result.guide).toContain('专业严肃题材');
    expect(result.guide).toContain('幽默和网感只能轻度使用');
    expect(result.guide).toContain('犀利只用于澄清误区');
  });

  test('旧版风格值自动兼容到新风格名称', async ({ page }) => {
    await page.evaluate(() => {
      window.fetch = () => new Promise(() => {});
      state.profile = { contentTone: '生活化真诚、轻松有梗' };
      runScriptRewrite('这是一个普通生活话题。');
    });
    const guide = await page.evaluate(() => state.profile.scriptStyleGuide);
    expect(guide).toContain('自然真实');
    expect(guide).toContain('风趣幽默');
    expect(guide).not.toContain('生活化真诚');
    expect(guide).not.toContain('轻松有梗');
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
