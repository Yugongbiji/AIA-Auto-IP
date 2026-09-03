const { test, expect } = require('@playwright/test');

test.describe('AIA stability 153-155', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('153: fallback 不再把职业和兴趣机械拼成一句话', async ({ page }) => {
    const headline = await page.evaluate(() => {
      const profile = {
        previousCareer: '财务工作经验',
        hobbies: '跑步',
        primaryGoal: 'customer_acquisition',
      };
      return window.aiaIpPolicy.headline(profile, '');
    });
    expect(headline).not.toContain('生活里喜欢跑步');
    expect(headline).not.toMatch(/财务.*跑步/);
  });

  test('154: 本人填写优势不能被包装成多人反馈', async ({ page }) => {
    const result = await page.evaluate(() => {
      const profile = {
        strengths: '行动力强、靠谱',
        peerReviewSummary: null,
      };
      return window.aiaIpPolicy.advantageItems(profile);
    });
    const text = result.map((item) => `${item.title} ${item.text}`).join(' ');
    expect(text).not.toContain('多人反馈');
    expect(text).not.toContain('他人评价');
    expect(text).toContain('个人优势');
    expect(text).toContain('行动力强');
  });

  test('154: 只有至少两份真实评价且同一特质出现两次才允许多人反馈', async ({ page }) => {
    const result = await page.evaluate(() => {
      const profile = {
        strengths: '专业靠谱',
        peerReviewSummary: {
          reviewCount: 2,
          topTraits: [
            { label: '行动力强', count: 2 },
            { label: '靠谱', count: 1 },
          ],
        },
      };
      return window.aiaIpPolicy.advantageItems(profile);
    });
    const peer = result.find((item) => item.title === '他人评价');
    expect(peer).toBeTruthy();
    expect(peer.text).toContain('多人反馈提到：行动力强');
    expect(peer.text).not.toContain('靠谱');
  });

  test('155: 素材充足时简介人物正文至少三行', async ({ page }) => {
    const result = await page.evaluate(() => {
      const profile = {
        previousCareer: '8年财务工作经验',
        hobbies: '跑步、阅读、旅行',
        education: '本科',
        insuranceYears: '2年',
        honors: 'MDRT',
        strengths: '靠谱、行动力强、有温度',
        services: '家庭保障｜养老规划｜保单检视',
        department: '正式验收测试',
      };
      const body = window.aiaIpPolicy.bioBody(profile, 'video');
      const bios = window.aiaIpPolicy.buildBios(profile, 'video', '8年财务经历，把专业讲得更清楚');
      return { body, bios };
    });
    expect(result.body.length).toBeGreaterThanOrEqual(3);
    expect(result.bios[0].lines.length).toBeGreaterThanOrEqual(7); // >=3正文 + headline + 3条合规尾部
  });
});
