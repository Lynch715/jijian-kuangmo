const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = [];
  for (const scale of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: scale, colorScheme: 'dark', reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    for (const name of ['poster-qr', 'poster']) {
      errors.length = 0;
      const url = new URL(`posters/${name}.html`, process.env.POSTER_BASE || 'http://127.0.0.1:18765/').href;
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const check = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
        images: [...document.images].every(i => i.complete && i.naturalWidth > 0),
        fonts: [...document.fonts].map(f => ({ family: f.family, weight: f.weight, status: f.status })),
        textOverflow: [...document.querySelectorAll('.subtitle,.feature,.call-copy h2,.footer')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent)
      }));
      if (!check.images || check.width !== 1080 || check.height !== 1920 || check.textOverflow.length || check.fonts.some(f => f.status === 'error') || errors.length) throw new Error(JSON.stringify({check, errors}));
      const filename = `${name}${scale === 2 ? '-hd' : ''}.png`;
      await page.screenshot({ path: path.join(__dirname, '../posters', filename) });
      report.push({ filename, width: 1080 * scale, height: 1920 * scale, check, errors: [...errors] });
    }
    await context.close();
  }
  fs.writeFileSync(path.join(__dirname, '../output/playwright/poster-render-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
