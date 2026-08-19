const { test, expect } = require('@playwright/test');

async function enterGuestIp(page) {
  await page.goto('/');
  await page.getByRole('button', { name: '我不在名单中，直接开始' }).click();
  await expect(page.locator('#workspace')).toBeVisible();
  await expect(page.locator('#ip-chat-panel')).toBeVisible();
}

test.describe('移动端与长会话边界', () => {
  test('超长连续文本不能撑出聊天区域或页面', async ({ page }) => {
    await enterGuestIp(page);
    const longToken = 'AIA_AUTO_IP_'.repeat(90);
    await page.evaluate((text) => {
      const node = document.createElement('div');
      node.className = 'message assistant';
      node.textContent = text;
      document.querySelector('#messages').appendChild(node);
    }, longToken);
    await page.waitForTimeout(300);

    const overflow = await page.evaluate(() => {
      const workspace = document.querySelector('#workspace');
      const message = document.querySelector('#messages .message:last-child');
      const wr = workspace.getBoundingClientRect();
      const mr = message.getBoundingClientRect();
      return {
        documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        workspaceOverflow: workspace.scrollWidth > workspace.clientWidth + 1,
        messageOutside: mr.left < wr.left - 1 || mr.right > wr.right + 1,
      };
    });
    expect(overflow.documentOverflow).toBeFalsy();
    expect(overflow.workspaceOverflow).toBeFalsy();
    expect(overflow.messageOutside).toBeFalsy();
  });

  test('用户主动上翻历史后暂停自动跟随，并可回到最新', async ({ page }) => {
    await enterGuestIp(page);
    await page.evaluate(() => {
      const box = document.querySelector('#messages');
      for (let i = 0; i < 28; i += 1) {
        const node = document.createElement('div');
        node.className = `message ${i % 2 ? 'user' : 'assistant'}`;
        node.textContent = `历史消息 ${i + 1}：用于测试长会话滚动状态。`;
        box.appendChild(node);
      }
    });
    await page.waitForTimeout(500);

    const messages = page.locator('#messages');
    await messages.dispatchEvent('pointerdown');
    await page.evaluate(() => {
      const box = document.querySelector('#messages');
      box.scrollTop = 0;
      box.dispatchEvent(new Event('scroll'));
    });
    await expect(page.getByRole('button', { name: '回到最新消息' })).toBeVisible();

    const before = await messages.evaluate((box) => box.scrollTop);
    await page.evaluate(() => {
      const node = document.createElement('div');
      node.className = 'message assistant';
      node.textContent = '这是一条新产生的 AI 回复，用户仍在看历史时不应把页面抢回底部。';
      document.querySelector('#messages').appendChild(node);
    });
    await page.waitForTimeout(350);
    const after = await messages.evaluate((box) => box.scrollTop);
    expect(after).toBeLessThanOrEqual(before + 2);

    await page.getByRole('button', { name: '回到最新消息' }).click();
    await expect(page.getByRole('button', { name: '回到最新消息' })).toBeHidden();
    await page.waitForTimeout(350);
    const distance = await messages.evaluate((box) => box.scrollHeight - box.scrollTop - box.clientHeight);
    expect(distance).toBeLessThan(8);
  });

  test('可视高度缩小时 Composer 和发送按钮仍在视口内', async ({ page }) => {
    await enterGuestIp(page);
    await page.locator('#chat-input').click();
    const initial = page.viewportSize();
    const compactHeight = Math.min(initial.height, 500);
    await page.setViewportSize({ width: initial.width, height: compactHeight });
    await page.waitForTimeout(250);

    const geometry = await page.evaluate(() => {
      const form = document.querySelector('#chat-form');
      const send = form.querySelector('button[type="submit"]');
      const fr = form.getBoundingClientRect();
      const sr = send.getBoundingClientRect();
      return {
        formBottom: fr.bottom,
        sendBottom: sr.bottom,
        viewportHeight: window.innerHeight,
      };
    });
    expect(geometry.formBottom).toBeLessThanOrEqual(geometry.viewportHeight + 2);
    expect(geometry.sendBottom).toBeLessThanOrEqual(geometry.viewportHeight + 2);
  });
});
