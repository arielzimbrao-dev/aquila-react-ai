import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { PKG, install, cleanup, aquila, project, readIn } from './helpers.mjs';

test('deep-audit: skill points to the methodology and template without duplicating the method', () => {
  const skill = readFileSync(join(PKG, 'skills/aquila-deep-audit/SKILL.md'), 'utf8');
  assert.match(skill, /^---\r?\nname: aquila-deep-audit\r?\n/);
  assert.match(skill, /description: >-/);
  assert.ok(skill.length <= 4500, `skill too long: ${skill.length}`);
  assert.match(skill, /\]\(\.\.\/\.\.\/core\/deep-audit\.md\)/);
  assert.match(skill, /\]\(references\/report-template\.md\)/);
  assert.match(skill, /audit_<datetime>\.md/);
  assert.match(skill, /\$ARGUMENTS/);
});

test('deep-audit: methodology requires severity, evidence, coverage and limits', () => {
  const method = readFileSync(join(PKG, 'core/deep-audit.md'), 'utf8');
  for (const requirement of [
    'CRITICAL',
    'HIGH',
    'MEDIUM',
    'LOW',
    'confidence',
    'hypothes',
    'not verified',
    'business',
    'security',
    'performance',
    'contracts',
    'idempoten',
    'observability',
    'production',
    'secret',
    'UTC',
    'do not overwrite',
    'does not guarantee',
    'tokens',
    'no fixes',
  ]) {
    assert.ok(method.toLowerCase().includes(requirement.toLowerCase()), requirement);
  }
  assert.match(method, /impact.*likelihood/s);
  assert.match(method, /entry.*domain.*output/s);
});

test('deep-audit: template requires a table, finding details and execution gaps', () => {
  const template = readFileSync(
    join(PKG, 'skills/aquila-deep-audit/references/report-template.md'),
    'utf8',
  );
  for (const heading of [
    '## Executive summary',
    '## Scope and context',
    '## Coverage',
    '## Checks run',
    '## Findings',
    '## Hypotheses',
    '## Improvements',
    '## Protections',
    '## Limitations',
  ])
    assert.ok(template.includes(heading), heading);
  assert.match(template, /\| ID \| Severity \|.*Confidence.*Evidence/);
  for (const field of ['Impact', 'Conditions', 'reproduction', 'Recommendation', 'regression test'])
    assert.ok(template.includes(field), field);
});

test('deep-audit: init/sync make the skill reachable without running an audit', () => {
  const root = project();
  try {
    install(root);
    const init = aquila(root, 'init', '--mode=team', '--tools=copilot,claude,codex', '--lint=off');
    assert.equal(init.code, 0, init.out);
    assert.match(readIn(root, 'AGENTS.md'), /`aquila-deep-audit`/);
    const alias = '.claude/commands/aquila-deep-audit.md';
    assert.ok(existsSync(join(root, alias)));
    assert.match(readIn(root, alias), /aquila:aquila-deep-audit/);
    assert.match(readIn(root, '.vscode/settings.json'), /"\.aquila\/skills": true/);
    assert.equal(aquila(root, 'check').code, 0);
    assert.match(aquila(root, 'sync').out, /already in sync/);
    const changed = aquila(root, 'init', '--tools=codex', '--lint=off');
    assert.equal(changed.code, 0, changed.out);
    assert.ok(!existsSync(join(root, alias)));
    assert.match(readIn(root, 'AGENTS.md'), /\.aquila\/skills\/<command>\/SKILL\.md/);
  } finally {
    cleanup(root);
  }
});
