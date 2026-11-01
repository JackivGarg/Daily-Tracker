import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createApp } from './app.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(projectRoot, '.env'), quiet: true });
const app = createApp({
  dbPath: process.env.DB_PATH ? resolve(projectRoot, process.env.DB_PATH) : resolve(projectRoot, '.data/tracker.sqlite'),
  staticDir: resolve(projectRoot, 'dist'),
});
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Daily Tracker is ready at http://127.0.0.1:${port}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(() => { app.locals.close(); process.exit(0); });
  });
}
