const { test, expect } = require('@playwright/test');

test.describe('产品规则 V7 回归', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('脚本库多标题只保留第一个且去掉序号，结构标记全部清理', async ({ page }) => {
    const cleaned = await page.evaluate(() => window.cleanScriptLibrarySource(`
1. 为什么越努力越焦虑
2. 成年人的焦虑从哪里来
3. 你不是不努力，只是方向错了
开头：买房最怕什么？
正文1：很多人第一反应是房价跌。
正文2：但真正麻烦的是现金流。
正文3：尤其是收入不稳定的时候。
结尾：所以买房前先算清楚自己的承受力。
`));
    expect(cleaned).toBe([
      '为什么越努力越焦虑',
      '买房最怕什么？',
      '很多人第一反应是房价跌。',
      '但真正麻烦的是现金流。',
      '尤其是收入不稳定的时候。',
      '所以买房前先算清楚自己的承受力。',
    ].join('\n'));
    expect(cleaned).not.toMatch(/标题?[123]|正文[123]|开头|结尾/);
  });

  test('标题1/2/3格式同样只保留第一个标题', async ({ page }) => {
    const cleaned = await page.evaluate(() => window.cleanScriptLibrarySource(`标题1：第一个标题\n标题2：第二个标题\n标题3：第三个标题\n脚本正文：正文内容`));
    expect(cleaned).toBe('第一个标题\n正文内容');
  });

  test('正文里的普通 1/2/3 编号列表不会被当成候选标题删掉', async ({ page }) => {
    const cleaned = await page.evaluate(() => window.cleanScriptLibrarySource(`真正的标题\n开头：先说结论。\n正文1：下面有三个步骤。\n1. 第一步先确认需求\n2. 第二步再比较方案\n3. 第三步最后决定\n结尾：就这么简单。`));
    expect(cleaned).toContain('1. 第一步先确认需求');
    expect(cleaned).toContain('2. 第二步再比较方案');
    expect(cleaned).toContain('3. 第三步最后决定');
    expect(cleaned).not.toContain('开头：');
    expect(cleaned).not.toContain('正文1：');
    expect(cleaned).not.toContain('结尾：');
  });

  test('小红书发送到 API 前已经清理脚本库结构标记', async ({ page }) => {
    let body;
    await page.route('**/api/xhs/format', async (route) => {
      body = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ formattedText: body.source, suggestedTags: [], risks: [] }) });
    });
    await page.evaluate(async () => {
      creativeState.xhs.started = true;
      await runXhsFormat('1. 第一标题\n2. 第二标题\n3. 第三标题\n开头：第一句。\n正文1：第二句。\n结尾：最后一句。');
    });
    expect(body.source).toBe('第一标题\n第一句。\n第二句。\n最后一句。');
  });

  test('小红书处理中提示使用当前用户可理解文案，不暴露内部方法论', async ({ page }) => {
    await page.route('**/api/xhs/format', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ formattedText: '正文', suggestedTags: [], risks: [] }) });
    });
    await page.evaluate(() => {
      creativeState.xhs.started = true;
      runXhsFormat('正文');
    });
    await expect(page.locator('#xhs-messages')).toContainText('正在整理手机阅读节奏');
    await expect(page.locator('#xhs-messages')).not.toContainText('内部方法论');
  });
});
