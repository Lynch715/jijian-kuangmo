const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 2, colorScheme: 'dark', reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [], actions = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const base = process.env.GAME_URL || 'http://127.0.0.1:18765/';
  await page.goto(base, { waitUntil: 'networkidle' });
  console.log((await page.locator('#modal').innerText()).slice(-500));
  await page.getByRole('button', { name: /开启新手引导/ }).click();
  await page.getByRole('button', { name: '开始经营', exact: true }).click();
  async function settle() {
    for (let n = 0; n < 20 && await page.locator('#modal').isVisible(); n++) {
      const button = page.locator('#modal button[data-act="choice"]').first();
      if (!await button.count()) throw new Error('Unexpected dialog: ' + await page.locator('#modal').innerText());
      actions.push({ choice: await button.innerText() });
      await button.click();
    }
  }
  for (let month = 0; month < 8; month++) {
    // 通过实际的算标、投标和月度结算界面推进，不改存档、不伪造数值。
    const open = page.locator('#tenders button[data-act="open"]').first();
    if (await open.count()) {
      await open.click();
      const submit = page.locator('button[data-act="submit"]');
      if (await submit.count() && await submit.isEnabled()) { actions.push({ bid: await page.locator('.bidwrap').innerText() }); await submit.click(); }
      else { const cancel = page.locator('button[data-act="cancel"]'); if (await cancel.count()) await cancel.click(); }
    }
    await page.locator('.side button[data-act="adv"]').click();
    await settle();
    actions.push({ month: month + 1, date: await page.locator('#s-month').innerText(), kpis: await page.locator('#kpis').innerText() });
  }
  await page.evaluate(() => document.fonts.ready);
  const out = path.join(__dirname, '../posters/assets');
  fs.mkdirSync(out, { recursive: true });
  await page.locator('#kpis').screenshot({ path: path.join(out, 'game-kpis.png') });
  await page.locator('#skyline').screenshot({ path: path.join(out, 'game-skyline.png') });
  await page.locator('#tenders').locator('..').screenshot({ path: path.join(out, 'game-tenders.png') });
  await page.locator('#chart').locator('..').locator('..').screenshot({ path: path.join(out, 'game-cashflow.png') });
  await page.screenshot({ path: path.join(out, 'game-desktop.png'), fullPage: false });
  await page.locator('.side [data-tab="map"]').click();
  await page.locator('#tab-map > .panel').screenshot({ path: path.join(out, 'game-map.png') });
  await page.locator('.side [data-tab="ops"]').click();
  const before = await page.evaluate(() => localStorage.getItem('dongda-mvp-v1'));
  await page.reload({ waitUntil: 'networkidle' });
  const after = await page.evaluate(() => localStorage.getItem('dongda-mvp-v1'));
  const state = JSON.parse(after);
  if (before !== after) throw new Error('刷新后存档发生变化');
  const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  fs.writeFileSync(path.join(__dirname, '../output/playwright/capture-report.json'), JSON.stringify({ base, months: state.t, sizes, savePreserved: before === after, errors, actions }, null, 2));
  console.log(JSON.stringify({ months: state.t, sizes, savePreserved: before === after, errors, assets: fs.readdirSync(out).filter(x => x.endsWith('.png')) }));
  await browser.close();
  if (errors.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
