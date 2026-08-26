const { test, expect } = require('@playwright/test');

async function enterGuest(page) {
  await page.goto('/');
  await page.getByRole('button', { name: '我不在名单中，直接开始' }).click();
  await expect(page.locator('#workspace')).toBeVisible();
}

test.describe('当前真实资料与昵称契约', () => {
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

  test('客户高频真实称呼优先于 preferredName，且一个昵称只有一个称呼主体', async ({ page }) => {
    await enterGuest(page);
    const result = await page.evaluate(() => {
      const profile = {
        name: '王静', preferredName: '静静',
        peerReviewSummary: { topNicknames: [{ label: '静姐', count: 5 }, { label: '静静', count: 2 }] },
      };
      return window.aiaNicknamePolicyV1.controlledOptions(profile);
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toContain('静姐');
    for (const item of result) {
      expect((item.name.match(/静姐/g) || []).length).toBeLessThanOrEqual(1);
    }
  });

  test('原有跨平台昵称一致时可谨慎保留，不一致时给统一提醒', async ({ page }) => {
    await enterGuest(page);
    const same = await page.evaluate(() => window.aiaProductRulesV29.auditExistingNicknames({
      name: '王静', videoNickname: '静姐说保障', xiaohongshuNickname: '静姐说保障',
      peerReviewSummary: { topNicknames: [{ label: '静姐', count: 5 }] },
    }));
    expect(same.same).toBeTruthy();
    expect(same.candidates.length).toBeGreaterThan(0);

    await page.evaluate(() => {
      state.profile = { name: '王静', videoNickname: '静姐说保障', xiaohongshuNickname: '静静聊保障' };
      const content = document.getElementById('proposal-content');
      content.innerHTML = '<section id="nick"><h2>推荐昵称</h2><div>候选昵称</div></section>';
      window.aiaProductRulesV29.renderNicknameAuditInPlace();
    });
    await expect(page.locator('.nickname-audit-card')).toContainText('建议统一为同一个长期昵称');
  });
});
