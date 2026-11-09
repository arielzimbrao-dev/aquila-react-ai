// Model per role (core/models.md): adapters/models.json is the single list; the frontmatters follow it.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { PKG } from './helpers.mjs';

const MODELS = JSON.parse(readFileSync(join(PKG, 'adapters/models.json'), 'utf8'));
const field = (file, key) =>
  new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(readFileSync(file, 'utf8').split(/^---$/m)[1] ?? '')?.[1]?.trim();
const agents = readdirSync(join(PKG, 'agents')).map((f) => [f.replace(/\.md$/, ''), join(PKG, 'agents', f)]);
const skills = readdirSync(join(PKG, 'skills')).map((d) => [d, join(PKG, 'skills', d, 'SKILL.md')]);

test('models.json lists every role and skill, each with a known level and model', () => {
  const names = [...agents, ...skills].map(([name]) => `${name}`);
  for (const name of names) assert.ok(MODELS.roles[name], `${name} missing from adapters/models.json`);
  for (const [name, level] of Object.entries(MODELS.roles)) {
    assert.ok(names.includes(name), `${name} in models.json has no agent or skill`);
    assert.ok(MODELS.levels[level], `${name}: unknown level ${level}`);
  }
});

test('agent and skill frontmatters carry the model of their level (Claude Code applies it)', () => {
  const wrong = [...agents.map(([n, f]) => [`agents/${n}`, n, f]), ...skills.map(([n, f]) => [`skills/${n}`, n, f])]
    .filter(([, name, file]) => field(file, 'model') !== MODELS.levels[MODELS.roles[name]])
    .map(([where, name, file]) => `${where}: ${field(file, 'model')} ≠ ${MODELS.levels[MODELS.roles[name]]}`);
  assert.deepEqual(wrong, []);
});

test('only execute, init and config are kept from model invocation (they change code or the setup)', () => {
  const manual = skills.filter(([, file]) => field(file, 'disable-model-invocation') === 'true').map(([n]) => n);
  assert.deepEqual(manual.sort(), ['aquila-config', 'aquila-execute', 'aquila-init']);
});
