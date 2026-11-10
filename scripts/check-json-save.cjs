const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const url = process.env.GAME_URL || 'http://127.0.0.1:18765/';
const out = path.join(__dirname, '../output/playwright/json-save-20261110');
const oldFile = process.env.JSON_SAVE_FIXTURE || path.join(__dirname, '../output/playwright/social-mobile-20261106/checkpoints/year-24.json');
const key = 'dongda-mvp-v1';
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = [];
  try {
    for (const [name, mobile, width, height] of [['desktop', false, 1440, 1000], ['mobile', true, 390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile, colorScheme: 'dark', acceptDownloads: true });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      const raw = () => page.evaluate(k => localStorage.getItem(k), key);
      const settings = () => page.locator(mobile ? '.m-save' : '.side [data-tab="save"]').click();
      async function readFile(file) {
        const waiting = page.waitForEvent('filechooser');
        await page.getByRole('button', { name: '读取 JSON 存档', exact: true }).click();
        await (await waiting).setFiles(file);
      }
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /开启新手引导/ }).click();
      await page.getByRole('button', { name: '开始经营', exact: true }).click();
      await settings();
      await page.locator('[data-act="slotsave"][data-id="1"]').click();
      await page.locator('[data-theme-mode="light"]').click();
      const before = await raw();
      const slot = await page.evaluate(() => localStorage.getItem('dongda-slot-1'));
      const downloadWait = page.waitForEvent('download');
      await page.getByRole('button', { name: '导出 JSON 存档', exact: true }).click();
      const download = await downloadWait;
      assert.equal(download.suggestedFilename(), '基建狂魔-东大建筑-2026年01月.json');
      const exported = path.join(out, `${name}-export.json`);
      await download.saveAs(exported);
      assert.deepEqual(JSON.parse(fs.readFileSync(exported, 'utf8')), JSON.parse(before));
      assert.equal(await raw(), before, '导出不得改写进度');
      assert.equal(await page.locator('#bk-text, [data-act="bkcopy"], [data-act="bkload"]').count(), 0);
      assert.ok(!(await page.locator('#backup').innerText()).includes('存档码'));
      // 直接通过文件选择器读取已有的 v5 两年存档，然后推进一个月。
      const legacy = fs.existsSync(oldFile), fixture = legacy ? oldFile : exported;
      const old = JSON.parse(fs.readFileSync(fixture, 'utf8'));
      await readFile(fixture);
      await page.waitForFunction(t => JSON.parse(localStorage.getItem('dongda-mvp-v1')).t === t, old.t);
      const restored = JSON.parse(await raw());
      for (const k of ['t', 'cash', 'qual', 'pms', 'projects', 'recv']) assert.deepEqual(restored[k], old[k]);
      const oldRaw = await raw();
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await raw(), oldRaw);
      await page.locator(mobile ? '.mbar [data-act="adv"]' : '.side [data-act="adv"]').click();
      for (let i = 0; await page.locator('#modal').isVisible(); i++) {
        assert.ok(i < 20);
        await page.locator('#modal button[data-act="choice"]').first().click();
      }
      assert.equal(JSON.parse(await raw()).t, old.t + 1);
      await settings();
      await readFile(exported);
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('dongda-mvp-v1')).t === 0);
      assert.deepEqual(JSON.parse(await raw()), JSON.parse(before), '导出的文件必须能完整恢复');
      await settings();
      // 无效、残缺和会导致渲染异常的文件均不得损坏现有进度。
      for (const [data, message] of [['{', '文件无法识别'], [JSON.stringify({ v: 5 }), '文件无法识别'], [JSON.stringify({ ...JSON.parse(before), pms: [null] }), '读取失败']]) {
        await readFile({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(data) });
        await page.waitForFunction(message => document.querySelector('#bk-msg').textContent.includes(message), message);
        assert.equal(await raw(), before);
      }
      // 浏览器拒绝写入时，内存和原存档都要保留。
      await page.evaluate(() => {
        window.jsonTestSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(k, v) { if (k === 'dongda-mvp-v1') throw new DOMException('Quota exceeded', 'QuotaExceededError'); return window.jsonTestSetItem.call(this, k, v); };
      });
      await readFile(fixture);
      await page.waitForFunction(() => document.querySelector('#bk-msg').textContent.includes('读取失败'));
      assert.equal(await raw(), before);
      assert.ok((await page.locator('#kpis').innerText()).includes('900万'));
      await page.evaluate(() => { Storage.prototype.setItem = window.jsonTestSetItem; delete window.jsonTestSetItem; });
      assert.equal(await page.evaluate(() => localStorage.getItem('dongda-slot-1')), slot);
      assert.equal(await page.evaluate(() => localStorage.getItem('jijian-kuangmo-theme')), 'light');
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await raw(), before);
      await settings();
      await page.locator('#backup').scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(out, `${name}.png`), animations: 'disabled' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      assert.deepEqual(errors, []);
      report.push({ url, name, download: download.suggestedFilename(), exportedStateEqual: true, exportDoesNotChangeSave: true, fileRoundTrip: true, legacyFixture: legacy ? oldFile : null, oldSaveMonth: legacy ? old.t : null, continuedMonth: old.t + 1, refreshPreserved: true, invalidFilesPreserveSave: true, quotaFailurePreservesSave: true, manualSlotAndThemePreserved: true, noSaveCode: true, errors });
      await context.close();
    }
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
