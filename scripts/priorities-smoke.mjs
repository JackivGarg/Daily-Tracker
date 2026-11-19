import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { createApp } from '../server/app.js';

const out = resolve(process.env.QA_OUTPUT_DIR || 'test-results/priorities');
await mkdir(out, { recursive: true });
const today = '2026-11-19';
const before = '2026-11-18';
const app = createApp({ dbPath: ':memory:', staticDir: resolve('dist'), now: () => new Date(today + 'T10:00:00Z'), apiKey: '' });
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = 'http://127.0.0.1:' + server.address().port;
const errors = [];
const views = [];
let browser;

async function open(page) {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(request.failure()?.errorText);
  });
  await page.goto(base + '/priorities');
  await expect(page.getByRole('heading', { name: 'Daily Priorities' })).toBeVisible();
  await expect(page.locator('.priority-canvas')).toHaveAttribute('data-ready', 'true');
}

try {
  browser = await chromium.launch({
    executablePath: process.env.QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--enable-webgl', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
  await open(page);
  const scene = page.locator('.priority-canvas');
  const log = page.getByRole('button', {name: 'Save priorities'});
  await expect(log).toBeDisabled();
  const seed = await page.request.patch(base + '/api/entries/' + today, {
    data: { status: 'red', travelDone: true, weight: 73, workoutRating: 4, muscles: { Chest: 4 } },
  });
  assert.ok(seed.ok());
  await page.reload();
  await page.getByRole('spinbutton', {name: /Study minutes/}).fill('72');
  await page.getByRole('textbox', {name: /Study topic/}).fill('Synthetic QA topic');
  await page.getByRole('group', {name: 'Gym session'}).getByRole('button', {name: 'Yes', exact: true}).click();
  await page.getByRole('group', {name: 'Guitar practice'}).getByRole('button', {name: 'Yes', exact: true}).click();
  await page.getByRole('spinbutton', {name: /Practice minutes/}).fill('20');
  await expect(page.getByText('0 of 3 done')).toBeVisible();
  await log.click();
  await expect(page.getByText('3 of 3 done')).toBeVisible();
  await expect(log).toBeDisabled();
  const actual = await (await page.request.get(base + '/api/entries/' + today)).json();
  assert.deepEqual(
    { studyMinutes: actual.studyMinutes, workoutDone: actual.workoutDone, guitarMinutes: actual.guitarMinutes,
      status: actual.status, travelDone: actual.travelDone, weight: actual.weight, workoutRating: actual.workoutRating, muscles: actual.muscles },
    { studyMinutes: 72, workoutDone: true, guitarMinutes: 20, status: 'red', travelDone: true, weight: 73, workoutRating: 4, muscles: { Chest: 4 } },
  );
  await page.getByRole('button', {name: 'Add workout ratings'}).click();
  await expect(page).toHaveURL(new RegExp('/check-in/training\\?date=' + today));
  await expect(page.getByRole('group', {name: 'Worked out today'}).getByRole('button', {name: 'Yes', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await page.goBack();
  await expect(page.getByText('3 of 3 done')).toBeVisible();
  await page.getByRole('button', {name: 'Previous priority day'}).click();
  await expect(page.getByLabel('Priority date')).toHaveValue(before);
  await expect(page.getByText('0 of 3 done')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Priority date')).toHaveValue(before);
  await page.getByRole('button', {name: 'Next priority day'}).click();
  await expect(page.getByText('3 of 3 done')).toBeVisible();

  for (const [width, height] of [[1440, 900], [768, 1024], [390, 844]]) {
    await page.setViewportSize({width, height});
    await page.reload();
    await expect(scene).toHaveAttribute('data-ready', 'true');
    const canvas = await scene.locator('canvas').elementHandle();
    await page.screenshot({path: resolve(out, `Priorities-${width}-overview.png`)});
    for (const [chapter, title] of [[1, 'Study'], [2, 'Gym'], [3, 'Guitar'], [2, 'Gym'], [1, 'Study']]) {
      await page.getByRole('navigation', {name: 'Jump to a priority'}).getByRole('button', {name: new RegExp(title)}).click();
      await expect(scene).toHaveAttribute('data-progress', new RegExp('^' + chapter + '\\.00[0-5]$'));
      assert.ok(await scene.locator('canvas').evaluate((element, initial) => element === initial, canvas));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const stats = await scene.evaluate((element) => ({
        calls: Number(element.dataset.calls), triangles: Number(element.dataset.triangles),
      }));
      assert.ok(stats.calls > 0 && stats.calls < 40 && stats.triangles > 0 && stats.triangles < 10000);
      if (!views.some((v) => v.width === width && v.title === title)) {
        views.push({width, height, title, ...stats});
        await page.screenshot({path: resolve(out, `Priorities-${width}-${title.toLowerCase()}.png`)});
      }
    }
    await canvas.dispose();
  }
  await page.getByRole('button', {name: 'Pause motion'}).click();
  const paused = await scene.getAttribute('data-progress');
  await page.getByRole('navigation', {name: 'Jump to a priority'}).getByRole('button', {name: /Guitar/}).click();
  await expect(scene).toHaveAttribute('data-progress', paused);
  await page.getByRole('button', {name: 'Resume motion'}).click();
  await expect(scene).toHaveAttribute('data-progress', '3.000');
  const frames = await scene.getAttribute('data-frames');
  await page.waitForTimeout(200);
  await expect(scene).toHaveAttribute('data-frames', frames);
  await page.getByRole('button', {name: 'Static view'}).click();
  await expect(page.locator('.priority-static')).toBeVisible();
  assert.equal(await page.locator('.priority-static i[data-lit=true]').count(), 3);
  await page.screenshot({path: resolve(out, 'Priorities-static.png')});
  await page.getByRole('button', {name: 'Show 3D'}).click();
  await expect(scene).toHaveAttribute('data-ready', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('navigation', {name: 'Jump to a priority'}).getByRole('button', {name: /Gym/}).click();
  await expect(scene).toHaveAttribute('data-progress', '2.000');
  await scene.locator('canvas').evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await expect(page.locator('.priority-static')).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Gym', exact: true})).toBeVisible();
  assert.deepEqual(errors, []);
  await writeFile(resolve(out, 'Priorities-QA.json'), JSON.stringify({ browser: browser.version(), views, errors }, null, 2));
  console.log('Shared entries, dates, nine viewport compositions, pause, reduced motion and context loss passed.');
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
  app.locals.store.close();
}
