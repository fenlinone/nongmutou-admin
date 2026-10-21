import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '/Users/sky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(`${root}reference`, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1025 }, acceptDownloads: true });
// 直接用 file:// 打开交付物并断网，确保不依赖开发服务器或 CDN。
await context.setOffline(true);
const page = await context.newPage();
const errors = [];
const remoteRequests = [];
const passed = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('request', request => { if (/^https?:/.test(request.url())) remoteRequests.push(request.url()); });
const check = async (name, run) => { await run(); passed.push(name); console.log(`通过：${name}`); };
const query = () => page.getByRole('button', { name: /^查\s*询$/ }).click();
const reset = async () => { await page.getByRole('button', { name: '重置', exact: true }).click(); await page.waitForTimeout(80); };
const total = () => page.locator('.record-total').innerText();
const bodyRows = () => page.locator('.weigh-table-card .ant-table-body tr.ant-table-row');
try {
  await check('根目录入口离线跳转并保留 Hash 路由', async () => {
    await page.goto(new URL('../index.html#/weighing/summary', import.meta.url).href);
    await page.waitForURL('**/delivery/index.html#/weighing/summary');
    await page.getByText('共 5 位工人', { exact: true }).waitFor();
  });
  await page.goto(new URL('../delivery/index.html', import.meta.url).href);
  await page.getByText('共 1,860 条记录', { exact: true }).waitFor();
  await check('离线打开、首屏数据、Logo 与资源完整性', async () => {
    assert.equal(await bodyRows().count(), 20);
    assert.match(await bodyRows().first().innerText(), /张三/);
    assert.match(await bodyRows().nth(7).innerText(), /作废/);
    assert.equal(await page.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `${root}reference/采摘称重-明细.png`, fullPage: true });
  });
  await check('分页与记录序号', async () => {
    await page.locator('.ant-pagination-item-2').click();
    assert.match(await bodyRows().first().innerText(), /21/);
    await page.locator('.ant-pagination-item-1').click();
  });
  await check('查看记录与筐称重关联', async () => {
    await bodyRows().first().getByRole('button', { name: '查看', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByText('称重记录详情').waitFor();
    assert.match(await dialog.innerText(), /6\.20 kg/);
    await dialog.locator('.ant-modal-close').click();
    await bodyRows().first().getByRole('button', { name: 'BK202610160001' }).click();
    await page.getByRole('dialog').getByText('24.00 kg').waitFor();
    await page.getByRole('dialog').locator('.ant-modal-close').click();
  });
  await check('工人模糊查询、空结果、重置', async () => {
    await page.locator('#worker').fill('G001'); await query();
    await page.waitForTimeout(80);
    assert.match(await total(), /466/);
    assert.equal(await bodyRows().evaluateAll(rows => rows.every(row => row.textContent.includes('张三'))), true);
    await page.locator('#worker').fill('没有这个工人'); await query();
    await page.getByText('暂无符合条件的称重记录').waitFor();
    assert.match(await total(), /0/);
    await reset(); assert.match(await total(), /1,860/);
  });
  await check('状态筛选与作废记录', async () => {
    await page.locator('#status').click();
    await page.locator('.ant-select-dropdown:visible').getByText('作废', { exact: true }).click();
    await query(); await page.waitForTimeout(80);
    assert.equal(await bodyRows().evaluateAll(rows => rows.every(row => row.textContent.includes('作废'))), true);
    await reset();
  });
  await check('列显隐与恢复默认', async () => {
    await page.getByRole('button', { name: '列设置', exact: true }).click();
    await page.locator('.column-settings').getByLabel('工号', { exact: true }).uncheck();
    assert.equal(await page.locator('.ant-table-header th').filter({ hasText: /^工号$/ }).count(), 0);
    await page.getByRole('button', { name: '恢复默认', exact: true }).click();
    assert.equal(await page.locator('.ant-table-header th').filter({ hasText: /^工号$/ }).count(), 1);
    await page.getByRole('button', { name: '列设置', exact: true }).click();
  });
  await check('选择记录并导出实际 CSV 文件', async () => {
    await bodyRows().first().getByRole('checkbox').check();
    await page.getByText('导出时仅导出选中记录').waitFor();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出', exact: true }).click();
    const download = await downloadPromise;
    await download.saveAs(`${root}reference/selected.csv`);
    const csv = await readFile(`${root}reference/selected.csv`, 'utf8');
    assert.equal(csv.trim().split('\r\n').length, 2);
    assert.match(csv, /张三/);
    await page.getByRole('button', { name: '取消选择', exact: true }).click();
  });
  await check('日期筛选及有效产量汇总计算', async () => {
    await page.locator('.ant-picker input').first().click();
    await page.locator('.ant-picker-dropdown:visible td[title="2026-10-16"]').first().click();
    await page.locator('.ant-picker-dropdown:visible td[title="2026-10-16"]').first().click();
    await query(); await page.waitForTimeout(80);
    assert.equal(await total(), '共 8 条记录');
    await page.getByRole('tab', { name: '工人产量汇总' }).click();
    await page.waitForTimeout(80);
    assert.equal(await total(), '共 5 位工人');
    const rows = await bodyRows().allInnerTexts();
    assert.equal(rows.some(row => row.includes('张三') && row.includes('12.10')), true);
    assert.equal(rows.some(row => row.includes('陈七') && row.includes('0.00')), true);
    const validWeight = await bodyRows().evaluateAll(rows => rows.reduce((sum, row) => sum + Number(row.querySelector('strong')?.textContent ?? 0), 0));
    assert.equal(validWeight.toFixed(2), '37.00');
    await page.locator('.ant-message-notice').first().waitFor({ state: 'hidden' });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${root}reference/采摘称重-汇总.png`, fullPage: true });
    await bodyRows().first().getByRole('button', { name: '查看', exact: true }).click();
    await page.getByRole('dialog').getByText('12.10 kg').waitFor();
    await page.getByRole('dialog').locator('.ant-modal-close').click();
  });
  await check('Hash 路由前进后退、侧栏展开收起', async () => {
    await page.goBack(); await page.getByRole('tab', { name: '逐桶称重明细' }).waitFor();
    assert.equal(await page.getByRole('tab', { name: '逐桶称重明细' }).getAttribute('aria-selected'), 'true');
    await page.goForward(); await page.waitForTimeout(80);
    assert.equal(await page.getByRole('tab', { name: '工人产量汇总' }).getAttribute('aria-selected'), 'true');
    await page.getByRole('button', { name: '收起侧边栏', exact: true }).click();
    await page.getByRole('button', { name: '展开侧边栏', exact: true }).click();
    await page.getByRole('tab', { name: '逐桶称重明细' }).click(); await reset();
  });
  await check('窄屏无页面横向溢出', async () => {
    for (const width of [1280, 1024, 800]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `宽度 ${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 1025 });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${root}reference/采摘称重-明细.png`, fullPage: true });
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(remoteRequests, []);
  await writeFile(`${root}reference/verification.json`, JSON.stringify({ passed, errors, remoteRequests, viewport: '1440 × 1025', offline: true }, null, 2));
  console.log(`共 ${passed.length} 项场景通过；无控制台错误；无网络请求。`);
} finally { await browser.close(); }
