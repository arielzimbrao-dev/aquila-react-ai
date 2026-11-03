import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { PKG } from './helpers.mjs';

const readJson = (path) => JSON.parse(readFileSync(join(PKG, path), 'utf8'));

test('Claude plugin metadata has a valid manifest and marketplace entry', () => {
  const plugin = readJson('.claude-plugin/plugin.json');
  const marketplace = readJson('.claude-plugin/marketplace.json');

  assert.match(plugin.name, /^[a-z][a-z0-9-]*$/);
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
  assert.ok(plugin.description.trim(), 'plugin description is required');
  assert.ok(plugin.author?.name?.trim(), 'plugin author is required');

  assert.match(marketplace.name, /^[a-z][a-z0-9-]*$/);
  assert.ok(marketplace.owner?.name?.trim(), 'marketplace owner is required');
  assert.ok(Array.isArray(marketplace.plugins) && marketplace.plugins.length > 0);
  assert.ok(
    marketplace.plugins.some(
      (entry) =>
        entry.name === plugin.name &&
        entry.source === './' &&
        typeof entry.description === 'string' &&
        entry.description.trim(),
    ),
    'marketplace must publish this plugin from the repository root',
  );
});

test('package.json, plugin.json and the changelog share the published version', () => {
  const { version } = readJson('package.json');
  assert.equal(readJson('.claude-plugin/plugin.json').version, version);
  const changelog = readFileSync(join(PKG, 'CHANGELOG.md'), 'utf8');
  const heading = changelog.match(/^## .+$/m)?.[0].trim();
  const latest = /^## (\d+\.\d+\.\d+) — (\d{4}-\d{2}-\d{2})$/.exec(heading ?? '');
  assert.ok(latest, 'changelog must start with a dated semantic release');
  assert.equal(latest[1], version);
});

test('README identifies the current release', () => {
  const { version } = readJson('package.json');
  const readme = readFileSync(join(PKG, 'README.md'), 'utf8');
  assert.ok(readme.includes(`**${version}**`), `README must mention **${version}**`);
});
