import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStore } from './store.js';
import { emptyEntry, todayInIndia, validDate, validateEntry, validateSettings, ValidationError } from './model.js';
import { generateCoach } from './coach.js';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function createApp({
  dbPath = process.env.DB_PATH || resolve('.data/tracker.sqlite'),
  staticDir = resolve('dist'),
  apiKey = process.env.GROQ_API_KEY,
  model = process.env.GROQ_MODEL,
  now = () => new Date(),
  fetcher = fetch,
} = {}) {
  const store = createStore(dbPath);
  const app = express();
  app.disable('x-powered-by');
  app.locals.store = store;
  app.locals.close = () => store.close();
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    // Protect a loopback service against cross-site writes and DNS rebinding.
    if (!LOCAL_HOSTS.has(req.hostname)) return res.status(403).json({ error: 'Open the tracker using localhost or 127.0.0.1.' });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'Cross-site writes are not allowed.' });
      const origin = req.get('origin');
      if (origin) {
        try {
          const parsed = new URL(origin);
          if (!LOCAL_HOSTS.has(parsed.hostname) || !['http:', 'https:'].includes(parsed.protocol)) throw new Error();
        } catch {
          return res.status(403).json({ error: 'Only the local tracker can update your data.' });
        }
      }
      if (!req.is('application/json')) return res.status(415).json({ error: 'Send updates as application/json.' });
    }
    next();
  });
  app.use(express.json({ limit: '1mb', strict: true }));

  const dayOptions = () => ({ startDate: store.settings().startDate, today: todayInIndia(now()) });
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/bootstrap', (_req, res) => {
    res.json({ settings: store.settings(), entries: store.entries(), today: todayInIndia(now()) });
  });
  app.get('/api/entries/:date', (req, res) => {
    const date = validDate(req.params.date, dayOptions());
    res.json(store.entry(date) || emptyEntry(date));
  });
  app.patch('/api/entries/:date', (req, res) => {
    const date = validDate(req.params.date, dayOptions());
    const entry = validateEntry(date, req.body, store.entry(date) || emptyEntry(date), dayOptions());
    store.saveEntry(entry);
    res.json(entry);
  });
  app.patch('/api/settings', (req, res) => {
    const settings = validateSettings(req.body, store.settings());
    store.saveSettings(settings);
    res.json(settings);
  });
  app.get('/api/export', (_req, res) => {
    res.setHeader('Content-Disposition', `attachment; filename="daily-tracker-${todayInIndia(now())}.json"`);
    res.json({ version: 1, exportedAt: now().toISOString(), settings: store.settings(), entries: store.entries() });
  });
  app.post('/api/import', (req, res) => {
    const backup = req.body;
    if (!backup || typeof backup !== 'object' || Array.isArray(backup) || !backup.settings || !Array.isArray(backup.entries)) {
      throw new ValidationError('Choose a tracker JSON backup containing settings and entries.');
    }
    if (backup.version !== undefined && backup.version !== 1) throw new ValidationError('This backup version is not supported.');
    if (backup.entries.length > 20000) throw new ValidationError('A backup can contain at most 20,000 days.');
    const settings = validateSettings(backup.settings, store.settings());
    const dates = new Set();
    // Validate the entire document before beginning any database write.
    const entries = backup.entries.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new ValidationError('Every imported day must be an object.');
      const date = validDate(entry.date, dayOptions());
      if (dates.has(date)) throw new ValidationError(`The backup contains duplicate entries for ${date}.`);
      dates.add(date);
      return validateEntry(date, entry, emptyEntry(date), dayOptions());
    });
    store.import(settings, entries);
    res.json({ imported: entries.length, settings: store.settings(), entries: store.entries() });
  });
  let coachWindowStart = 0;
  let coachRequests = 0;
  app.post('/api/coach', async (_req, res) => {
    const clock = Date.now();
    if (clock - coachWindowStart > 60000) { coachWindowStart = clock; coachRequests = 0; }
    if (++coachRequests > 10) return res.status(429).json({ error: 'Give your reflection a moment. Try again in a minute.' });
    const result = await generateCoach({ entries: store.entries(), settings: store.settings(), today: todayInIndia(now()), apiKey, model, fetcher });
    res.json(result);
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'That tracker endpoint does not exist.' }));

  if (staticDir && existsSync(resolve(staticDir, 'index.html'))) {
    app.use(express.static(staticDir));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || !req.accepts('html')) return next();
      res.sendFile(resolve(staticDir, 'index.html'));
    });
  }
  app.use((_req, res) => res.status(404).json({ error: 'Page not found.' }));
  app.use((error, _req, res, _next) => {
    if (error instanceof ValidationError) return res.status(error.status).json({ error: error.message });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'This file is too large. Choose a backup smaller than 1 MB.' });
    if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ error: 'The request contains invalid JSON.' });
    // Never echo dependency or upstream errors: they may contain private data.
    res.status(500).json({ error: 'Your update could not be saved. Please try again.' });
  });
  return app;
}
