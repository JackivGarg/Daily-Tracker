import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = process.env.QA_OUTPUT_DIR || resolve(root, 'test-results/ui');
await mkdir(output, { recursive: true });
const temporary = await mkdtemp(join(tmpdir(), 'momentum-ui-qa-'));
const app = createApp({ dbPath: join(temporary, 'tracker.sqlite'), staticDir: resolve(root, 'dist'), now: () => new Date('2026-11-01T10:00:00Z'), apiKey: '' });
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const baseURL = `http://127.0.0.1:${server.address().port}`;
const report = { fixture: 'Temporary SQLite database; no production data used or written.', testedAt: new Date().toISOString(), runtime: process.version, browser: '', checks: [], consoleErrors: [], requestFailures: [], screenshots: [], worldMetrics: [], layout: [] };
let browser;
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function check(name, action) {
  try { await action(); report.checks.push({ name, passed: true }); }
  catch (error) { report.checks.push({ name, passed: false, error: error.message }); console.error(`${name}: ${error.message}`); }
}
async function capture(page, name, fullPage = false) {
  const path = join(output, `${name}.png`);
  await page.screenshot({ path, fullPage });
  report.screenshots.push(path);
}
async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await delay(600);
}
async function nav(page, name) {
  if (await page.getByRole('button', { name: 'Open navigation', exact: true }).isVisible()) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.locator('.sidebar .nav-link').filter({ hasText: name }).click();
  await settle(page);
}
async function step(page, name, path) {
  await page.getByRole('navigation', { name: 'Check-in sections', exact: true }).getByRole('button', { name, exact: true }).click();
  await delay(100);
  assert.equal(new URL(page.url()).pathname, `/check-in/${path}`);
  assert.equal(await page.locator('.checkin-sections .entry-section:visible').count(), 1);
}
function track(page) {
  page.on('pageerror', error => report.consoleErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  page.on('requestfailed', request => report.requestFailures.push({ url: request.url().replace(baseURL, '<local>'), error: request.failure()?.errorText }));
}
try {
  browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  track(page);
  await check('Empty production-build dashboard renders at desktop, tablet and mobile', async () => {
    for (const [suffix, width, height] of [['', 1440, 900], ['-tablet', 768, 1024], ['-mobile', 390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.goto(baseURL);
      await page.getByRole('heading', { name: 'Your everyday, in perspective.' }).waitFor();
      await settle(page);
      await page.waitForFunction(() => { const scene = document.querySelector('.garden-render'); return scene && ['true', 'fallback'].includes(scene.dataset.worldReady); });
      await capture(page, `Momentum-dashboard${suffix}`);
      await capture(page, `Momentum-dashboard${suffix}-full`, true);
      const layout = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth }));
      report.layout.push({ surface: 'dashboard', ...layout });
      assert.ok(layout.documentWidth <= width + 1, `Dashboard overflows at ${width}px`);
    }
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await check('Daily check-in saves all requested fields through visible controls', async () => {
    await nav(page, 'Daily check-in');
    assert.equal(new URL(page.url()).pathname, '/check-in/reflection');
    await page.locator('.reflection-option.green').click();
    await page.getByRole('textbox', { name: /A note to your future self/ }).fill('QA note: a consistent starting point.');
    await step(page, 'Nutrition', 'nutrition');
    await page.goBack();
    assert.equal(new URL(page.url()).pathname, '/check-in/reflection');
    assert.equal(await page.getByRole('textbox', { name: /A note to your future self/ }).inputValue(), 'QA note: a consistent starting point.');
    await page.goForward();
    assert.equal(new URL(page.url()).pathname, '/check-in/nutrition');
    await page.getByRole('textbox', { name: 'Meal or food', exact: true }).fill('QA meal');
    await page.getByRole('spinbutton', { name: 'Calories (kcal)', exact: true }).fill('650');
    await page.getByRole('spinbutton', { name: 'Protein (g)', exact: true }).fill('32');
    await page.getByRole('button', { name: 'Add meal', exact: true }).click();
    await page.getByRole('group', { name: 'Had protein today', exact: true }).getByRole('button', { name: 'Yes', exact: true }).click();
    await page.getByRole('group', { name: 'Taken creatine today', exact: true }).getByRole('button', { name: 'No', exact: true }).click();
    await step(page, 'Training', 'training');
    await page.getByRole('group', { name: 'Worked out today', exact: true }).getByRole('button', { name: 'Yes', exact: true }).click();
    await page.getByRole('button', { name: 'Overall workout rating: 4 out of 5', exact: true }).click();
    await page.locator('.muscle-chips').getByRole('button', { name: 'Legs', exact: true }).click();
    await page.locator('.muscle-chips').getByRole('button', { name: 'Chest', exact: true }).click();
    await page.getByRole('button', { name: 'Legs rating: 4 out of 5', exact: true }).click();
    await page.getByRole('button', { name: 'Chest rating: 5 out of 5', exact: true }).click();
    await step(page, 'Body & weight', 'body');
    await page.getByRole('spinbutton', { name: "Today's weight (kg)", exact: true }).fill('72.5');
    await step(page, 'Study & focus', 'focus');
    await page.getByRole('spinbutton', { name: 'Study time (minutes)', exact: true }).fill('90');
    await page.getByRole('textbox', { name: 'What did you work on?', exact: true }).fill('QA study: algorithms');
    await step(page, 'Guitar', 'guitar');
    await page.getByRole('group', { name: 'Played guitar today', exact: true }).getByRole('button', { name: 'Yes', exact: true }).click();
    await page.getByRole('spinbutton', { name: 'Practice time (minutes)', exact: true }).fill('20');
    await page.getByRole('textbox', { name: 'What did you practice?', exact: true }).fill('QA guitar: chord changes');
    await page.getByRole('button', { name: 'Save check-in', exact: true }).click();
    await page.getByText('Saved to your personal history', { exact: true }).waitFor();
    const saved = await (await fetch(`${baseURL}/api/bootstrap`)).json();
    assert.equal(saved.entries.length, 1);
    const entry = saved.entries[0];
    assert.equal(entry.status, 'green');
    assert.equal(entry.meals[0].calories, 650);
    assert.equal(entry.meals[0].protein, 32);
    assert.equal(entry.proteinTaken, true);
    assert.equal(entry.creatineTaken, false);
    assert.equal(entry.workoutDone, true);
    assert.equal(entry.workoutRating, 4);
    assert.deepEqual(entry.muscles, { Legs: 4, Chest: 5 });
    assert.equal(entry.weight, 72.5);
    assert.equal(entry.studyMinutes, 90);
    assert.equal(entry.guitarDone, true);
    assert.equal(entry.guitarMinutes, 20);
    await step(page, 'Your day', 'reflection');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await delay(100);
    await capture(page, 'Momentum-check-in-recorded');
    await step(page, 'Training', 'training');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await delay(100);
    await capture(page, 'Momentum-check-in-training');
  });
  await check('Dashboard reload persists entry and renders actual nutrition and study totals', async () => {
    await page.reload();
    await settle(page);
    assert.equal(new URL(page.url()).pathname, '/check-in/training');
    assert.equal(await page.getByRole('button', { name: 'Legs rating: 4 out of 5', exact: true }).getAttribute('aria-pressed'), 'true');
    await nav(page, 'Overview');
    await page.reload();
    await settle(page);
    assert.equal(new URL(page.url()).pathname, '/dashboard');
    assert.equal((await page.locator('.metric').first().locator('.metric-value').innerText()).replace(/\s/g, ''), '650kcal');
    assert.match(await page.locator('.metric').nth(1).innerText(), /1h 30m/);
    assert.equal((await page.locator('.metric').nth(3).locator('.metric-value').innerText()).replace(/\s/g, ''), '01day');
    await capture(page, 'Momentum-dashboard-recorded');
  });
  await check('History supports status filters, note search and editable entry', async () => {
    await nav(page, 'Your history');
    assert.equal(await page.locator('tbody tr').count(), 1);
    assert.match(await page.locator('tbody').innerText(), /650 kcal/);
    assert.match(await page.locator('tbody').innerText(), /72.5 kg/);
    await page.getByRole('button', { name: 'Red day', exact: true }).click();
    await page.getByRole('heading', { name: 'No days match this view.' }).waitFor();
    await page.getByRole('button', { name: 'Green day', exact: true }).click();
    assert.equal(await page.locator('tbody tr').count(), 1);
    await page.getByRole('searchbox', { name: 'Search history' }).fill('QA note');
    assert.equal(await page.locator('tbody tr').count(), 1);
    await page.getByRole('searchbox', { name: 'Search history' }).fill('unmatched');
    assert.equal(await page.locator('tbody tr').count(), 0);
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await page.getByRole('button', { name: 'Edit 2026-11-01', exact: true }).click();
    await step(page, 'Body & weight', 'body');
    assert.equal(await page.getByRole('spinbutton', { name: "Today's weight (kg)", exact: true }).inputValue(), '72.5');
  });
  await check('Native page routes survive reload and browser Back/Forward', async () => {
    await nav(page, 'Your history');
    assert.equal(new URL(page.url()).pathname, '/history');
    await nav(page, 'Insights');
    assert.equal(new URL(page.url()).pathname, '/insights');
    await page.goBack();
    await page.getByRole('heading', { name: 'Every day has a story.' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/history');
    await page.goForward();
    await page.getByRole('heading', { name: 'See the bigger picture.' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/insights');
    await page.reload();
    await page.getByRole('heading', { name: 'See the bigger picture.' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/insights');
  });
  await check('Insights show real workout and guitar sessions and accept period changes', async () => {
    await nav(page, 'Insights');
    assert.match(await page.locator('.insight-summary').innerText(), /1h 30m/);
    await page.getByRole('combobox', { name: 'Insights period' }).selectOption('30');
    assert.match(await page.locator('.insight-summary').innerText(), /30/);
    assert.equal(await page.locator('.muscle-summary > div').count(), 8);
    await capture(page, 'Momentum-insights-recorded', true);
  });
  await check('Custom red and green meanings and goals save and persist', async () => {
    await nav(page, 'Goals & settings');
    await page.getByRole('textbox', { name: 'Green day label', exact: true }).fill('Aligned day');
    await page.getByRole('textbox', { name: 'Red day label', exact: true }).fill('Reset day');
    await page.getByRole('textbox', { name: 'What does this mean to you?', exact: true }).nth(0).fill('QA meaning: followed my personal priorities.');
    await page.getByRole('textbox', { name: 'What does this mean to you?', exact: true }).nth(1).fill('QA meaning: reflect without judgment.');
    await page.getByRole('spinbutton', { name: 'Calories (kcal)', exact: true }).fill('2300');
    await page.getByRole('button', { name: 'Save my settings', exact: true }).click();
    await page.getByText('Your settings are saved.', { exact: true }).waitFor();
    const backup = await (await fetch(`${baseURL}/api/export`)).json();
    assert.equal(backup.settings.greenLabel, 'Aligned day');
    assert.equal(backup.settings.redLabel, 'Reset day');
    assert.equal(backup.settings.calorieGoal, 2300);
    assert.equal(backup.entries[0].guitarMinutes, 20);
    assert.equal(backup.entries[0].proteinTaken, true);
    assert.equal(JSON.stringify(backup).includes('GROQ_API_KEY'), false);
    await nav(page, 'Daily check-in');
    assert.match(await page.locator('.reflection-option.green').innerText(), /Aligned day/);
  });
  await check('Offline reflection produces a useful local response', async () => {
    await nav(page, 'Overview');
    await page.getByRole('button', { name: 'Get my personal reflection', exact: false }).click();
    await page.getByText('Based on your entries · Local reflection', { exact: true }).waitFor();
    assert.ok((await page.locator('.coach-panel > p').first().innerText()).length > 30);
  });
  await check('3D world native scroll is reversible and renders at desktop, tablet and mobile', async () => {
    for (const [label, width, height] of [['desktop', 1440, 900], ['tablet', 768, 1024], ['mobile', 390, 844]]) {
      await page.setViewportSize({ width, height });
      await nav(page, 'Growth world');
      const scene = page.locator('.garden-render:not(.garden-render-preview)');
      await page.waitForFunction(() => document.querySelector('.garden-render:not(.garden-render-preview)')?.dataset.worldReady === 'true');
      await page.waitForFunction(() => Number(document.querySelector('.garden-render:not(.garden-render-preview)')?.dataset.worldDrawCalls) > 0);
      await delay(200);
      for (const [index, id] of ['show-up', 'strength', 'focus', 'whole-garden'].entries()) {
        await page.locator(`#${id}`).evaluate(element => window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - innerHeight * .4, behavior: 'instant' }));
        await delay(900);
        const metrics = await scene.evaluate(element => ({ ...element.dataset }));
        report.worldMetrics.push({ viewport: label, chapter: id, ...metrics });
        assert.ok(Number(metrics.worldDrawCalls) > 0, `No rendered geometry at ${label}:${id}`);
        assert.ok(Number(metrics.worldProgress) >= Math.max(0, index - .15), `World progress missing at ${label}:${id}`);
        if (index === 0 || index === 3) await capture(page, `Momentum-world-${label}-${id}`);
      }
      await page.locator('#show-up').evaluate(element => window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - innerHeight * .4, behavior: 'instant' }));
      await delay(700);
      assert.ok(Number(await scene.getAttribute('data-world-progress')) < .2, `${label} reverse scroll failed`);
      const layout = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth }));
      report.layout.push({ surface: 'world', ...layout });
      assert.ok(layout.documentWidth <= width + 1, `World overflows at ${width}px`);
      await nav(page, 'Overview');
    }
  });
  await check('Reduced motion and WebGL failure preserve an understandable, usable journey', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await nav(page, 'Growth world');
    await page.waitForFunction(() => document.querySelector('.garden-render:not(.garden-render-preview)')?.dataset.worldReady === 'true');
    await page.locator('#focus').evaluate(element => window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - innerHeight * .4, behavior: 'instant' }));
    await delay(200);
    await capture(page, 'Momentum-world-reduced-motion');
    await page.locator('.garden-render canvas').dispatchEvent('webglcontextlost', { bubbles: false, cancelable: true });
    await page.waitForFunction(() => document.querySelector('.garden-render:not(.garden-render-preview)')?.dataset.worldReady === 'fallback');
    await capture(page, 'Momentum-world-WebGL-fallback');
    assert.equal(await page.locator('.growth-chapter').count(), 4);
    await page.getByRole('button', { name: "Make today's check-in", exact: true }).click();
    await page.getByRole('heading', { name: 'A few minutes. Just for you.' }).waitFor();
  });
  await context.close();
} catch (error) {
  report.fatal = error.stack;
  console.error(error);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  app.locals.close();
  const absoluteTemporary = resolve(temporary);
  assert.ok(absoluteTemporary.startsWith(resolve(tmpdir()) + '\\') || absoluteTemporary.startsWith(resolve(tmpdir()) + '/'));
  await rm(absoluteTemporary, { recursive: true, force: true });
  report.passed = !report.fatal && report.checks.every(check => check.passed) && report.consoleErrors.length === 0;
  await writeFile(join(output, 'Momentum-QA-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks, consoleErrors: report.consoleErrors, requestFailures: report.requestFailures, worldMetrics: report.worldMetrics, report: join(output, 'Momentum-QA-report.json') }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
