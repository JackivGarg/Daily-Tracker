const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { readPrivateConfig, trustedNavigation, smokeDataDirectory } = require('./runtime.cjs');

test('packaged desktop reads private user configuration and never bundled secrets', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'momentum-config-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dataDirectory = path.join(root, 'private');
  const projectDirectory = path.join(root, 'resources');
  mkdirSync(dataDirectory);
  mkdirSync(projectDirectory);
  writeFileSync(path.join(projectDirectory, '.env'), 'GROQ_API_KEY=must-not-be-read\n');
  const missing = readPrivateConfig({ dataDirectory, projectDirectory, packaged: true });
  assert.equal(missing.configured, false);
  assert.equal(missing.apiKey, '');
  assert.equal(missing.model, 'openai/gpt-oss-120b');
  writeFileSync(path.join(dataDirectory, '.env'), 'GROQ_API_KEY=local-private-key\nGROQ_MODEL=openai/gpt-oss-20b\nPORT=9000\n');
  const configured = readPrivateConfig({ dataDirectory, projectDirectory, packaged: true });
  assert.equal(configured.apiKey, 'local-private-key');
  assert.equal(configured.model, 'openai/gpt-oss-20b');
  assert.equal(configured.configured, true);
  assert.equal(configured.PORT, undefined);
});

test('navigation stays within the exact internal app origin', () => {
  const origin = 'http://127.0.0.1:12345';
  assert.equal(trustedNavigation(`${origin}/#journal`, origin), true);
  assert.equal(trustedNavigation(`${origin}/api/bootstrap`, origin), true);
  for (const url of ['https://example.com', 'http://127.0.0.1:12346', 'http://127.0.0.1:12345.evil.example/', 'file:///etc/passwd', 'javascript:alert(1)', 'http://user:pass@127.0.0.1:12345/']) {
    assert.equal(trustedNavigation(url, origin), false, url);
  }
});

test('an isolated smoke profile requires both an explicit smoke flag and an absolute directory', () => {
  const location = path.resolve(os.tmpdir(), 'momentum-smoke-test');
  assert.equal(smokeDataDirectory([`--smoke-user-data=${location}`]), null);
  assert.equal(smokeDataDirectory(['--smoke-test']), null);
  assert.equal(smokeDataDirectory(['--smoke-test', `--smoke-user-data=${location}`]), location);
  assert.throws(() => smokeDataDirectory(['--smoke-test', '--smoke-user-data=relative']), /absolute/);
});
