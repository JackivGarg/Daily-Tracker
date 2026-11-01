import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createApp } from '../server/app.js';
import { DEFAULT_SETTINGS, emptyEntry } from '../server/model.js';
import { computeGrowth } from '../src/lib/growth.js';
import { shiftDate } from '../src/lib/metrics.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = resolve(process.env.QA_OUTPUT_DIR || join(root, 'test-results/growth'));
const temporary = await mkdtemp(join(tmpdir(), 'momentum-growth-qa-'));
await mkdir(output, { recursive: true });
const TODAY = '2027-02-01';
const report = {
  fixture: 'Synthetic QA history in isolated temporary SQLite databases only. No installed application database, key, or personal data is read or written.',
  date: TODAY, testedAt: new Date().toISOString(), checks: [], consoleErrors: [], requestFailures: [],
  scenes: [], screenshots: [], browser: '', layout: [],
};
let browser;
const fixtures = [];
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function syntheticHistory(greens, reds = 0, recovery = 0) {
  const count = greens + reds + recovery;
  return Array.from({ length: count }, (_, index) => {
    const red = index >= greens && index < greens + reds;
    const date = shiftDate(TODAY, index - count + 1);
    return {
      ...emptyEntry(date), status: red ? 'red' : 'green', workoutDone: !red,
      guitarDone: !red, sportsDone: false, travelDone: false,
      workoutRating: red ? null : 4, muscles: red ? {} : { Legs: 4, Core: 4 },
      note: 'Synthetic QA fixture, never saved in the installed app.',
      updatedAt: `${date}T12:00:00.000Z`,
    };
  });
}

async function fixture(name, entries = []) {
  const app = createApp({ dbPath: join(temporary, name, 'tracker.sqlite'), staticDir: join(root, 'dist'), now: () => new Date(`${TODAY}T10:00:00Z`), apiKey: '' });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseURL = `http://127.0.0.1:${server.address().port}`;
  fixtures.push({ app, server });
  if (entries.length) {
    const response = await fetch(`${baseURL}/api/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 1, settings: DEFAULT_SETTINGS, entries }) });
    assert.equal(response.status, 200, await response.text());
  }
  return { app, server, baseURL, entries };
}

async function check(name, action) {
  try { await action(); report.checks.push({ name, passed: true }); }
  catch (error) { report.checks.push({ name, passed: false, error: error.stack }); console.error(`${name}: ${error.message}`); }
}

function track(page) {
  page.on('pageerror', error => report.consoleErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  page.on('requestfailed', request => report.requestFailures.push({ url: request.url().replace(/http:\/\/127\.0\.0\.1:\d+/g, '<local fixture>'), error: request.failure()?.errorText }));
}

async function capture(page, name) {
  const path = join(output, `${name}.png`);
  await page.screenshot({ path });
  report.screenshots.push(path);
}

async function openWorld(page, baseURL) {
  await page.goto(`${baseURL}/growth`);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => {
    const scene = document.querySelector('.garden-render:not(.garden-render-preview)');
    return scene?.dataset.worldReady === 'true' && Number(scene.dataset.worldTriangles) > 0;
  });
  await delay(200);
}

const scene = (page) => page.locator('.garden-render:not(.garden-render-preview)');
const stats = (page) => scene(page).evaluate(element => ({ ...element.dataset }));

async function scrollChapter(page, id) {
  await page.locator(`#${id}`).evaluate(element => window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - innerHeight * .4, behavior: 'instant' }));
  await delay(750);
}

function assertState(metrics, expected) {
  assert.equal(Number(metrics.growthPoints), expected.points, 'Rendered points disagree with saved check-ins');
  assert.equal(Number(metrics.growthVitality), expected.vitality, 'Rendered vitality disagrees with saved check-ins');
  assert.equal(metrics.growthStage, expected.stage, 'Rendered stage disagrees with saved check-ins');
  assert.ok(Number(metrics.worldDrawCalls) > 0, 'No live geometry drawn');
}

try {
  browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  track(page);
  const empty = await fixture('empty');
  const mature = await fixture('mature', syntheticHistory(60));
  const dry = await fixture('dry', syntheticHistory(60, 8));
  const recovery = await fixture('recovery', syntheticHistory(60, 8, 3));
  const activities = await fixture('activities');

  await check('Empty history renders a real seed without invented growth', async () => {
    await openWorld(page, empty.baseURL);
    const metrics = await stats(page);
    assertState(metrics, computeGrowth([], TODAY));
    await capture(page, 'Growth-seed-overview');
    await scrollChapter(page, 'show-up');
    await capture(page, 'Growth-seed-world');
    report.scenes.push({ scenario: 'empty seed', ...metrics });
  });

  await check('Saved green streaks, gym branches and joy produce a mature lush tree', async () => {
    await openWorld(page, mature.baseURL);
    const expected = computeGrowth(mature.entries, TODAY);
    assert.equal(expected.stage, 'Full-grown tree');
    assert.equal(expected.points, 58);
    assert.equal(expected.branches, 12);
    assert.equal(expected.vitality, 100);
    assertState(await stats(page), expected);
    await capture(page, 'Growth-mature-overview');
    await scrollChapter(page, 'whole-garden');
    await capture(page, 'Growth-mature-world');
    report.scenes.push({ scenario: 'mature lush', ...await stats(page) });
  });

  await check('Red days pause size growth and explicitly joy-free days dry the same earned tree', async () => {
    await openWorld(page, dry.baseURL);
    const expected = computeGrowth(dry.entries, TODAY);
    assert.equal(expected.points, 58);
    assert.equal(expected.greenStreak, 0);
    assert.equal(expected.growthActive, false);
    assert.equal(expected.daysToUnlock, 3);
    assert.ok(expected.vitality < 50);
    assertState(await stats(page), expected);
    await capture(page, 'Growth-dry-overview');
    await scrollChapter(page, 'whole-garden');
    await capture(page, 'Growth-dry-world');
    report.scenes.push({ scenario: 'red and dry', ...await stats(page) });
  });

  await check('Three new greens resume retained growth and joy restores foliage', async () => {
    await openWorld(page, recovery.baseURL);
    const expected = computeGrowth(recovery.entries, TODAY);
    assert.equal(expected.points, 59);
    assert.equal(expected.greenStreak, 3);
    assert.equal(expected.growthActive, true);
    assert.ok(expected.vitality > computeGrowth(dry.entries, TODAY).vitality);
    assertState(await stats(page), expected);
    await capture(page, 'Growth-recovery-overview');
    await scrollChapter(page, 'whole-garden');
    await capture(page, 'Growth-recovery-world');
    report.scenes.push({ scenario: 'recovery', ...await stats(page) });
  });

  await check('Visible sports and travel answers save, survive reload and export into the growth model', async () => {
    await page.goto(`${activities.baseURL}/check-in/guitar?date=${TODAY}`);
    await page.getByRole('group', { name: 'Played guitar today', exact: true }).getByRole('button', { name: 'No', exact: true }).click();
    await page.getByRole('group', { name: 'Played sports today', exact: true }).getByRole('button', { name: 'Yes', exact: true }).click();
    await page.getByRole('group', { name: 'Travelled today', exact: true }).getByRole('button', { name: 'No', exact: true }).click();
    await page.getByRole('button', { name: 'Save check-in', exact: true }).click();
    await page.getByText('Saved to your personal history', { exact: true }).waitFor();
    await page.reload();
    await page.getByRole('group', { name: 'Played sports today', exact: true }).waitFor();
    assert.equal(await page.getByRole('group', { name: 'Played sports today', exact: true }).getByRole('button', { name: 'Yes', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('group', { name: 'Travelled today', exact: true }).getByRole('button', { name: 'No', exact: true }).getAttribute('aria-pressed'), 'true');
    await capture(page, 'Growth-activities-check-in');
    const exported = await (await fetch(`${activities.baseURL}/api/export`)).json();
    assert.equal(exported.entries.length, 1);
    assert.equal(exported.entries[0].guitarDone, false);
    assert.equal(exported.entries[0].sportsDone, true);
    assert.equal(exported.entries[0].travelDone, false);
    await openWorld(page, activities.baseURL);
    assertState(await stats(page), computeGrowth(exported.entries, TODAY));
    assert.equal(computeGrowth(exported.entries, TODAY).vitality, 83);
  });

  await check('Native scroll is reversible without changing earned growth or replacing the canvas', async () => {
    for (const [label, width, height] of [['desktop', 1440, 900], ['tablet', 768, 1024], ['mobile', 390, 844]]) {
      await page.setViewportSize({ width, height });
      await openWorld(page, mature.baseURL);
      const canvas = await scene(page).locator('canvas').elementHandle();
      const before = await stats(page);
      for (const [index, id] of ['show-up', 'strength', 'focus', 'whole-garden'].entries()) {
        await scrollChapter(page, id);
        const metrics = await stats(page);
        assertState(metrics, computeGrowth(mature.entries, TODAY));
        assert.ok(Number(metrics.worldProgress) >= Math.max(0, index - .2));
        assert.equal(await canvas.evaluate(element => element === document.querySelector('.garden-render:not(.garden-render-preview) canvas')), true);
        report.scenes.push({ viewport: label, chapter: id, ...metrics });
        if (index === 0 || index === 3) await capture(page, `Growth-${label}-${id}`);
      }
      await scrollChapter(page, 'show-up');
      const after = await stats(page);
      assert.equal(after.growthPoints, before.growthPoints);
      assert.equal(after.growthVitality, before.growthVitality);
      assert.ok(Number(after.worldProgress) < .2);
      const layout = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth }));
      report.layout.push({ surface: 'world', ...layout });
      assert.ok(layout.documentWidth <= width + 1, `${label} world overflows horizontally`);
    }
  });

  await check('Saved-history controls change the same live tree and return to today without saving anything', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWorld(page, mature.baseURL);
    await scrollChapter(page, 'show-up');
    const canvas = await scene(page).locator('canvas').elementHandle();
    const slider = page.getByRole('slider', { name: 'View saved growth history', exact: true });
    await slider.press('Home');
    await page.waitForFunction(() => document.querySelector('.garden-render:not(.garden-render-preview)')?.dataset.growthPoints === '0');
    await delay(700);
    assert.equal(await canvas.evaluate(element => element === document.querySelector('.garden-render:not(.garden-render-preview) canvas')), true);
    assert.equal((await stats(page)).growthStage, 'Seed');
    await capture(page, 'Growth-history-seed');
    await slider.press('ArrowRight');
    await slider.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('.garden-render:not(.garden-render-preview)')?.dataset.growthPoints === '1');
    await delay(700);
    assert.equal((await stats(page)).growthStage, 'Sprout');
    assert.equal(await canvas.evaluate(element => element === document.querySelector('.garden-render:not(.garden-render-preview) canvas')), true);
    await capture(page, 'Growth-history-sprout');
    await page.getByRole('button', { name: 'Back to today', exact: false }).click();
    await page.waitForFunction(() => document.querySelector('.garden-render:not(.garden-render-preview)')?.dataset.growthPoints === '58');
    assert.equal(await canvas.evaluate(element => element === document.querySelector('.garden-render:not(.garden-render-preview) canvas')), true);
    const unchanged = await (await fetch(`${mature.baseURL}/api/export`)).json();
    assert.equal(unchanged.entries.length, mature.entries.length);
    await page.getByRole('button', { name: 'Preview a full-grown tree', exact: true }).click();
    await page.getByText('Previewing a mature tree.', { exact: false }).waitFor();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await delay(700);
    await capture(page, 'Growth-explicit-mature-preview');
    await page.getByRole('button', { name: 'Return to my tree', exact: true }).first().click();
    assertState(await stats(page), computeGrowth(mature.entries, TODAY));
  });

  await check('On-demand rendering rests when settled and pause stops the optional breeze', async () => {
    await openWorld(page, mature.baseURL);
    await scrollChapter(page, 'show-up');
    await delay(1200);
    const first = Number((await stats(page)).worldFrames);
    await delay(750);
    assert.equal(Number((await stats(page)).worldFrames), first, 'Settled world keeps rendering unnecessarily');
    await page.getByRole('button', { name: 'Breeze off', exact: true }).click();
    await delay(300);
    const breezing = Number((await stats(page)).worldFrames);
    await delay(400);
    assert.ok(Number((await stats(page)).worldFrames) > breezing, 'Enabled breeze is not animating');
    await page.getByRole('button', { name: 'Pause motion', exact: true }).click();
    await delay(400);
    const paused = Number((await stats(page)).worldFrames);
    await delay(600);
    assert.equal(Number((await stats(page)).worldFrames), paused, 'Pause left the render loop running');
    await capture(page, 'Growth-paused-motion');
    await page.getByRole('button', { name: 'Resume motion', exact: true }).click();
    await page.getByRole('button', { name: 'Breeze on', exact: true }).click();
    await page.getByRole('button', { name: 'Static view', exact: true }).click();
    assert.equal(await scene(page).getAttribute('data-world-ready'), 'static');
    assert.equal(await scene(page).locator('canvas').count(), 0);
    await capture(page, 'Growth-static-view');
    await page.getByRole('button', { name: 'Show 3D', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.garden-render:not(.garden-render-preview)')?.dataset.worldReady === 'true');
    assertState(await stats(page), computeGrowth(mature.entries, TODAY));
  });

  await check('Reduced motion and WebGL loss retain the full labels, history and check-in action', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openWorld(page, dry.baseURL);
    await scrollChapter(page, 'focus');
    const reducedFrames = Number((await stats(page)).worldFrames);
    await delay(600);
    assert.equal(Number((await stats(page)).worldFrames), reducedFrames);
    await capture(page, 'Growth-reduced-motion');
    await scene(page).locator('canvas').dispatchEvent('webglcontextlost', { cancelable: true });
    await page.waitForFunction(() => document.querySelector('.garden-render:not(.garden-render-preview)')?.dataset.worldReady === 'fallback');
    await capture(page, 'Growth-WebGL-fallback');
    assert.equal(await page.locator('.growth-chapter').count(), 4);
    await page.getByRole('button', { name: "Make today's check-in", exact: true }).click();
    assert.equal(new URL(page.url()).pathname, '/check-in/reflection');
    await page.getByRole('heading', { name: 'A few minutes. Just for you.', exact: true }).waitFor();
  });
  await context.close();
} catch (error) {
  report.fatal = error.stack;
  console.error(error);
} finally {
  await browser?.close();
  for (const { app, server } of fixtures) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    app.locals.close();
  }
  const absoluteTemporary = resolve(temporary);
  assert.ok(absoluteTemporary.startsWith(resolve(tmpdir()) + sep), 'Cleanup escaped the temporary test directory');
  await rm(absoluteTemporary, { recursive: true, force: true });
  report.passed = !report.fatal && report.checks.length > 0 && report.checks.every(item => item.passed)
    && report.consoleErrors.length === 0 && report.requestFailures.length === 0;
  await writeFile(join(output, 'Growth-QA-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.map(({name,passed,error})=>({name,passed,...(error?{error}:{} )})), consoleErrors: report.consoleErrors, requestFailures: report.requestFailures, report: join(output, 'Growth-QA-report.json') }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
