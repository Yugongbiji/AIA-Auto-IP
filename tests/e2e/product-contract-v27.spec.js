const { test, expect } = require('@playwright/test');

async function enterGuest(page) {
  await page.goto('/');
  await page.getByRole('button', { name: '我不在名单中，直接开始' }).click();
  await expect(page.locator('#workspace')).toBeVisible();
}

test.describe('V27 真实资料与昵称契约', () => {
  test('报名长字段会标准化，自我介绍明确事实可补齐结构字段', async ({ page }) => {
    await enterGuest(page);
    const result = await page.evaluate(() => {
      const profile = {
        '简单的自我介绍（更了解您做自媒体的优势）': '以前做教师，现在是两个孩子的妈妈，平时喜欢跑马拉松。',
        '微信视频号昵称': '静姐说保障',
        '小红书昵称': '静姐说保障',
        '擅长领域 / 可提供服务': '养老规划｜保障规划',
      };
      window.aiaProfileRulesV27.extractFactsFromIntro(profile);
      return profile;
    });
    expect(result.selfIntro).toContain('教师');
    expect(result.previousCareer).toContain('教育/教师');
    expect(result.lifeRoles).toContain('宝妈');
    expect(result.hobbies).toContain('跑步');
    expect(result.services).toContain('养老规划');
    expect(result.videoNickname).toBe('静姐说保障');
    expect(result.xiaohongshuNickname).toBe('静姐说保障');
  });

  test('一个推荐昵称只能保留一个称呼主体', async ({ page }) => {
    await enterGuest(page);
    const result = await page.evaluate(() => {
      const proposal = { nicknameOptions: [{ name: '静姐说保障静静', reason: '' }] };
      const profile = { name: '王静', peerReviewSummary: { topNicknames: [{ label: '静静', count: 5 }, { label: '静姐', count: 3 }] } };
      window.normalizeNicknameOptionsV19(proposal, profile);
      return proposal.nicknameOptions[0].name;
    });
    expect(result).not.toBe('静姐说保障静静');
    expect((result.match(/静姐|静静/g) || []).length).toBe(1);
  });

  test('原有跨平台昵称一致时可优先保留，不一致时给统一提醒', async ({ page }) => {
    await enterGuest(page);
    const same = await page.evaluate(() => window.aiaProfileRulesV27.nicknameAudit({ videoNickname: '静姐说保障', xiaohongshuNickname: '静姐说保障' }));
    expect(same.preferred).toBe('静姐说保障');
    expect(same.message).toContain('优先建议保留');
    const different = await page.evaluate(() => window.aiaProfileRulesV27.nicknameAudit({ videoNickname: '静姐说保障', xiaohongshuNickname: '静静聊保障' }));
    expect(different.message).toContain('不一致');
    expect(different.message).toContain('统一');
  });
});
