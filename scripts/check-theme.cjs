const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.GAME_URL || 'http://127.0.0.1:18769/';
const out = path.join(__dirname, '../output/playwright/theme-20261109');
const themeKey = 'jijian-kuangmo-theme';

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = [];
  async function openSettings(page, mobile) {
    await page.locator(mobile ? '.m-save' : '.side [data-tab="save"]').click();
  }
  async function read(page) {
    return page.evaluate(key => ({
      choice: document.documentElement.getAttribute('data-theme') || 'auto',
      scheme: getComputedStyle(document.documentElement).colorScheme,
      background: getComputedStyle(document.body).backgroundColor,
      pressed: [...document.querySelectorAll('[data-theme-mode][aria-pressed="true"]')].map(b => b.dataset.themeMode),
      themeColors: [...document.querySelectorAll('meta[name="theme-color"]')].map(m => m.content),
      game: localStorage.getItem('dongda-mvp-v1'),
      preference: localStorage.getItem(key),
      viewportCount: document.querySelectorAll('meta[name="viewport"]').length,
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth
    }), themeKey);
  }
  async function expectTheme(page, choice, actual, savedGame) {
    const s = await read(page);
    assert.equal(s.choice, choice);
    assert.equal(s.scheme, actual);
    assert.equal(s.background, actual === 'dark' ? 'rgb(14, 20, 25)' : 'rgb(230, 234, 234)');
    assert.deepEqual(s.pressed, [choice]);
    assert.ok(s.themeColors.every(c => c === (actual === 'dark' ? '#FF7A2E' : '#D9530E')));
    assert.equal(s.game, savedGame, '主题切换不应改写游戏存档');
    assert.equal(s.viewportCount, 1);
    assert.equal(s.scrollWidth, s.width);
    return { ...s, game: '与切换前逐字相等' };
  }
  for (const [name, mobile, width, height, system] of [
    ['mobile', true, 390, 844, 'dark'],
    ['desktop', false, 1440, 1000, 'light']
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile, colorScheme: system, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /开启新手引导/ }).click();
    await page.getByRole('button', { name: '开始经营', exact: true }).click();
    await openSettings(page, mobile);
    // 保存一份手动存档，再确认主题操作不会更改自动与手动存档。
    await page.locator('[data-act="slotsave"][data-id="1"]').click();
    const slotBefore = await page.evaluate(() => localStorage.getItem('dongda-slot-1'));
    const before = (await read(page)).game;
    const results = [await expectTheme(page, 'auto', system, before)];
    for (const mode of ['light', 'dark']) {
      await page.locator(`[data-theme-mode="${mode}"]`).click();
      results.push(await expectTheme(page, mode, mode, before));
      assert.equal((await read(page)).preference, mode);
      await page.locator('.theme-options').scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => !document.querySelector('.toast'));
      await page.screenshot({ path: path.join(out, `${name}-${mode}.png`) });
      await page.reload({ waitUntil: 'networkidle' });
      await openSettings(page, mobile);
      await expectTheme(page, mode, mode, before);
    }
    await page.emulateMedia({ colorScheme: 'light' });
    await expectTheme(page, 'dark', 'dark', before);
    await page.locator('[data-theme-mode="auto"]').click();
    await expectTheme(page, 'auto', 'light', before);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => getComputedStyle(document.body).backgroundColor === 'rgb(14, 20, 25)' && document.documentElement.style.colorScheme === 'dark');
    await expectTheme(page, 'auto', 'dark', before);
    // 其他标签页打开时恢复偏好；后续更改通过 storage 事件同步。
    await page.locator('[data-theme-mode="light"]').click();
    const second = await context.newPage();
    await second.goto(base, { waitUntil: 'domcontentloaded' });
    assert.equal(await second.locator('html').getAttribute('data-theme'), 'light');
    await openSettings(second, mobile);
    await second.locator('[data-theme-mode="dark"]').click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await expectTheme(page, 'dark', 'dark', before);
    assert.equal(await page.evaluate(() => localStorage.getItem('dongda-slot-1')), slotBefore);
    assert.deepEqual(errors, []);
    report.push({ url: base, name, system, results, explicitChoiceOverridesSystem: true, refreshRestoresChoice: true, autoTracksSystemChanges: true, crossTabSync: true, autoAndManualSaveUnchanged: true, errors });
    await context.close();
  }
  const blocked = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('存储不可用', 'SecurityError'); } }));
  const page = await blocked.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /开启新手引导/ }).click();
  await page.getByRole('button', { name: '开始经营', exact: true }).click();
  await openSettings(page, true);
  await page.locator('[data-theme-mode="light"]').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(230, 234, 234)');
  assert.deepEqual(errors, []);
  report.push({ storageUnavailable: true, switchStillWorks: true, errors });
  await blocked.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.map(({ results, ...r }) => r)));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
