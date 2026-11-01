import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from './app.js';
import { DEFAULT_SETTINGS, emptyEntry, todayInIndia, validateEntry, validDate } from './model.js';

const NOW = new Date('2026-11-03T06:00:00Z');

async function fixture(t, options = {}) {
  const folder = mkdtempSync(join(tmpdir(), 'daily-tracker-test-'));
  const dbPath = join(folder, 'tracker.sqlite');
  let app = createApp({ dbPath, now: () => NOW, staticDir: null, apiKey: '', ...options });
  let server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let address = `http://127.0.0.1:${server.address().port}`;
  async function stop() {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    app.locals.close();
  }
  t.after(async () => { await stop(); rmSync(folder, { recursive: true, force: true }); });
  return {
    async request(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
      const response = await fetch(address + path, {
        method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
      });
      return { status: response.status, body: await response.json(), headers: response.headers };
    },
    async reopen() {
      await stop();
      app = createApp({ dbPath, now: () => NOW, staticDir: null, apiKey: '', ...options });
      server = app.listen(0, '127.0.0.1');
      await once(server, 'listening');
      address = `http://127.0.0.1:${server.address().port}`;
    },
  };
}

test('calendar dates and India-local midnight are validated accurately', () => {
  assert.equal(todayInIndia(new Date('2026-10-31T19:00:00Z')), '2026-11-01');
  assert.throws(() => validDate('2026-02-30', { today: '2026-11-03' }), /real calendar date/);
  assert.throws(() => validDate('2026-10-31', { today: '2026-11-03' }), /Tracking begins/);
  assert.throws(() => validDate('2026-11-04', { today: '2026-11-03' }), /Future days/);
  assert.throws(() => validateEntry('2026-11-01', { weight: -4 }, undefined, { today: '2026-11-03' }), /Weight/);
  assert.throws(() => validateEntry('2026-11-01', { muscles: { Chest: 6 } }, undefined, { today: '2026-11-03' }), /Chest rating/);
  assert.throws(() => validateEntry('2026-11-01', { proteinTaken: 'yes' }, undefined, { today: '2026-11-03' }), /true, false, or null/);
});

test('partial daily updates preserve other fields and persist across restart', async (t) => {
  const api = await fixture(t);
  const initial = await api.request('/api/bootstrap');
  assert.equal(initial.status, 200);
  assert.deepEqual(initial.body.entries, []);
  assert.equal(initial.body.today, '2026-11-03');
  const saved = await api.request('/api/entries/2026-11-01', { method: 'PATCH', body: {
    status: 'green', weight: 72.4, proteinTaken: true, creatineTaken: false,
    meals: [{ id: 'oats', name: 'Oats', calories: 320, protein: 15 }],
    workoutDone: true, workoutRating: 4, muscles: { Legs: 4, Core: 3 }, studyMinutes: 45,
  } });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.creatineTaken, false);
  assert.ok(saved.body.updatedAt);
  const partial = await api.request('/api/entries/2026-11-01', { method: 'PATCH', body: { guitarDone: true, guitarMinutes: 20 } });
  assert.equal(partial.body.meals[0].name, 'Oats');
  assert.equal(partial.body.studyMinutes, 45);
  assert.equal(partial.body.guitarMinutes, 20);
  await api.reopen();
  const result = await api.request('/api/bootstrap');
  assert.equal(result.body.entries.length, 1);
  assert.deepEqual(result.body.entries[0], partial.body);
});

test('invalid updates never modify previously saved data', async (t) => {
  const api = await fixture(t);
  const saved = await api.request('/api/entries/2026-11-01', { method: 'PATCH', body: { status: 'red', studyMinutes: 30 } });
  const invalid = await api.request('/api/entries/2026-11-01', { method: 'PATCH', body: { status: 'green', muscles: { Wrong: 3 } } });
  assert.equal(invalid.status, 400);
  assert.match(invalid.body.error, /Unknown muscle/);
  const result = await api.request('/api/entries/2026-11-01');
  assert.deepEqual(result.body, saved.body);
  const future = await api.request('/api/entries/2026-11-04', { method: 'PATCH', body: { status: 'green' } });
  assert.equal(future.status, 400);
});

test('backup imports validate atomically and merge without deleting unseen dates', async (t) => {
  const api = await fixture(t);
  await api.request('/api/entries/2026-11-01', { method: 'PATCH', body: { status: 'green' } });
  const before = await api.request('/api/bootstrap');
  const invalid = await api.request('/api/import', { method: 'POST', body: {
    settings: { ...DEFAULT_SETTINGS, name: 'Changed' }, entries: [
      { ...emptyEntry('2026-11-02'), status: 'red' },
      { ...emptyEntry('2026-11-03'), weight: 'broken' },
    ],
  } });
  assert.equal(invalid.status, 400);
  assert.deepEqual((await api.request('/api/bootstrap')).body, before.body);
  const imported = await api.request('/api/import', { method: 'POST', body: {
    settings: { ...DEFAULT_SETTINGS, name: 'Restored', greenMeaning: 'My own meaning' },
    entries: [{ ...emptyEntry('2026-11-02'), status: 'red' }],
  } });
  assert.equal(imported.status, 200);
  assert.equal(imported.body.imported, 1);
  assert.equal(imported.body.entries.length, 2);
  assert.equal(imported.body.settings.name, 'Restored');
  const duplicate = await api.request('/api/import', { method: 'POST', body: {
    settings: DEFAULT_SETTINGS, entries: [emptyEntry('2026-11-03'), emptyEntry('2026-11-03')],
  } });
  assert.equal(duplicate.status, 400);
  assert.match(duplicate.body.error, /duplicate/);
  const backup = await api.request('/api/export');
  assert.equal(backup.body.version, 1);
  assert.equal(backup.body.entries.length, 2);
  assert.match(backup.headers.get('content-disposition'), /daily-tracker/);
});

test('personal settings are validated and cannot alter the start date', async (t) => {
  const api = await fixture(t);
  const result = await api.request('/api/settings', { method: 'PATCH', body: { greenLabel: 'Aligned', redMeaning: 'Time to reset', studyGoal: 90 } });
  assert.equal(result.status, 200);
  assert.equal(result.body.greenLabel, 'Aligned');
  assert.equal(result.body.calorieGoal, 2200);
  assert.equal((await api.request('/api/settings', { method: 'PATCH', body: { startDate: '2020-01-01' } })).status, 400);
  assert.equal((await api.request('/api/settings', { method: 'PATCH', body: { guitarGoal: 0 } })).status, 400);
});

test('cross-site writes and malformed requests produce useful safe errors', async (t) => {
  const api = await fixture(t);
  const crossSite = await api.request('/api/entries/2026-11-01', { method: 'PATCH', body: { status: 'green' }, headers: { Origin: 'https://evil.example' } });
  assert.equal(crossSite.status, 403);
  const local = await api.request('/api/entries/2026-11-01', { method: 'PATCH', body: { status: 'green' }, headers: { Origin: 'http://localhost:5173' } });
  assert.equal(local.status, 200);
  const malformed = await api.request('/api/settings', { method: 'PATCH', body: '{no', raw: true });
  assert.equal(malformed.status, 400);
  assert.match(malformed.body.error, /invalid JSON/);
  const huge = await api.request('/api/settings', { method: 'PATCH', body: { name: 'x'.repeat(1100000) } });
  assert.equal(huge.status, 413);
  assert.equal((await api.request('/api/no-such-endpoint')).status, 404);
});

test('coach sends only structured totals and never exposes the API key', async (t) => {
  const key = 'gsk_private-test-key';
  let request;
  const api = await fixture(t, {
    apiKey: key,
    fetcher: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ choices: [{ message: { content: `You logged a meal. ${key}` } }] }) };
    },
  });
  await api.request('/api/entries/2026-11-03', { method: 'PATCH', body: { note: 'Private thought', studyNote: 'Private study', meals: [{ id: 'meal-1', name: 'Private meal name', calories: 300, protein: 20 }] } });
  const coach = await api.request('/api/coach', { method: 'POST', body: {} });
  assert.equal(coach.status, 200);
  assert.equal(coach.body.source, 'groq');
  assert.ok(!JSON.stringify(coach.body).includes(key));
  assert.equal(request.options.headers.Authorization, `Bearer ${key}`);
  assert.equal(request.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.ok(!request.options.body.includes('Private thought'));
  assert.ok(!request.options.body.includes('Private study'));
  assert.ok(!request.options.body.includes('Private meal name'));
  const backup = await api.request('/api/export');
  assert.ok(!JSON.stringify(backup.body).includes(key));
  assert.ok(!JSON.stringify((await api.request('/api/bootstrap')).body).includes(key));
});

test('coach remains useful when Groq is unavailable', async (t) => {
  const api = await fixture(t, { apiKey: 'gsk_not-logged', fetcher: async () => { throw new Error('upstream failure with credential'); } });
  const coach = await api.request('/api/coach', { method: 'POST', body: {} });
  assert.equal(coach.status, 200);
  assert.equal(coach.body.source, 'local');
  assert.match(coach.body.text, /first check-in/);
  assert.ok(!JSON.stringify(coach.body).includes('credential'));
});
