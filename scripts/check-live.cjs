const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const base = process.env.GAME_URL || 'https://lynch715.github.io/jijian-kuangmo/';
  const out = path.join(__dirname, '../output/playwright/live');
  fs.mkdirSync(out, { recursive: true });
  const report = { url: base, checks: [] };
  for (const [name, options] of [
    ['desktop', { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, colorScheme: 'dark' }],
    ['iphone13', { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'dark' }]
  ]) {
    const context = await browser.newContext({ ...options, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [], failedResponses = [], failedRequests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) failedResponses.push({ url: r.url(), status: r.status() }); });
    page.on('requestfailed', r => failedRequests.push({ url: r.url(), error: r.failure()?.errorText }));
    const response = await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('[data-act="setbg"][data-v="pri"]').click();
    await page.locator('[data-act="setdk"][data-v="std"]').click();
    await page.getByRole('button', { name: /开启新手引导/ }).click();
    await page.getByRole('button', { name: '开始经营', exact: true }).click();
    const initial = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('dongda-mvp-v1'));
      return { background: state.bg, difficulty: state.dk, cash: state.cash, projects: state.projects.length,
        cashText: document.querySelector('#kpis .kpi')?.innerText,
        projectsText: document.querySelector('#projects')?.innerText };
    });
    if (initial.background !== 'pri' || initial.difficulty !== 'std' || initial.cash !== 900 || initial.projects !== 0 || !initial.cashText.includes('900万') || !initial.projectsText.includes('没有在建项目')) throw new Error('民营起家初始状态不正确：' + JSON.stringify(initial));
    await page.locator('#projects').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, `${name}-private-start.png`) });
    const monthButton = name === 'desktop' ? '.side [data-act="adv"]' : '.mbar [data-act="adv"]';
    const dialogs = [];
    for (let i = 0; i < 3; i++) {
      await page.locator(monthButton).click();
      for (let n = 0; n < 20 && await page.locator('#modal').isVisible(); n++) {
        const b = page.locator('#modal button[data-act="choice"]').first();
        if (!await b.count()) throw new Error('Unexpected dialog');
        dialogs.push(await b.innerText());
        await b.click();
      }
    }
    const before = await page.evaluate(() => localStorage.getItem('dongda-mvp-v1'));
    await page.reload({ waitUntil: 'networkidle' });
    const after = await page.evaluate(() => localStorage.getItem('dongda-mvp-v1'));
    if (before !== after) throw new Error(`${name}: 存档未保持`);
    const save = JSON.parse(after);
    const pages = [];
    let mobileSave;
    for (const tab of ['map', 'corp', 'honor', 'save', 'ops']) {
      let selector = name === 'desktop' ? `.side [data-tab="${tab}"]` : tab === 'save' ? '.m-save' : `.mbar [data-tab="${tab}"]`;
      await page.locator(selector).click();
      pages.push(await page.evaluate(tab => ({ tab, viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }), tab));
      if (name === 'iphone13' && tab === 'save') {
        const back = page.getByRole('button', { name: '← 返回', exact: true });
        const credit = page.locator('#tab-save .credit');
        mobileSave = { backVisible: await back.isVisible(), credit: (await credit.innerText()).replace(/\s+/g, ' ').trim() };
        if (!mobileSave.backVisible || !/制作人 大老师.*微信 lynchrrr/.test(mobileSave.credit)) throw new Error('手机存档页缺少返回或制作人信息');
        await back.scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(out, 'iphone13-save-top.png') });
        await credit.scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(out, 'iphone13-save-bottom.png') });
        await page.locator('#tab-save').screenshot({ path: path.join(out, 'iphone13-save-page.png') });
        await back.click();
        mobileSave.backWorks = await page.locator('#tab-honor').isVisible();
        if (!mobileSave.backWorks) throw new Error('存档页返回未回到上一个页面');
      }
    }
    await page.evaluate(() => { window.scrollTo(0, 0); });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false });
    const metadata = await page.evaluate(() => ({
      doctype: document.doctype?.name,
      language: document.documentElement.lang,
      viewport: document.querySelector('meta[name="viewport"]')?.content,
      viewportCount: document.querySelectorAll('meta[name="viewport"]').length,
      viewportInHead: document.head.contains(document.querySelector('meta[name="viewport"]')),
      title: document.title,
      ogTitle: document.querySelector('meta[property="og:title"]')?.content,
      ogDescription: document.querySelector('meta[property="og:description"]')?.content,
      ogImage: document.querySelector('meta[property="og:image"]')?.content,
      favicon: document.querySelector('link[rel="icon"]')?.href
    }));
    const assets = [];
    for (const url of [metadata.ogImage, metadata.favicon]) {
      const r = await context.request.get(url);
      assets.push({ url, status: r.status(), type: r.headers()['content-type'] });
    }
    const check = { name, viewport: options.viewport, status: response.status(), newGame: true, initial, advancedMonths: save.t, savePreserved: before === after, mobileSave, pages, metadata, assets, errors, failedResponses, failedRequests, dialogs };
    report.checks.push(check);
    console.log(JSON.stringify(check));
    await context.close();
    if (response.status() !== 200 || metadata.viewportCount !== 1 || !metadata.viewportInHead || metadata.viewport !== 'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover' || !metadata.title.startsWith('基建狂魔') || metadata.ogTitle !== '基建狂魔' || metadata.ogDescription !== '从一支施工队，到特级资质、上市公司' || !metadata.ogImage.includes('/jijian-kuangmo/') || save.t !== 3 || errors.length || failedResponses.length || failedRequests.length || pages.some(p => p.scrollWidth > p.viewport) || assets.some(a => a.status !== 200)) throw new Error(`${name}: 线上检查未全部通过`);
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
