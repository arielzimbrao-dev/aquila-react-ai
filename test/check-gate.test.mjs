import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  project,
  aquila,
  aquilaWithEnv,
  readIn,
  editConfig,
  cleanup,
  install,
  git,
} from './helpers.mjs';
import { ciCaller } from '../bin/aquila.mjs';

test('check validates aquila.json: types and values fail, unknown keys warn', () => {
  const root = project();
  try {
    aquila(root, 'init');
    const { $schema } = JSON.parse(readIn(root, 'docs/ai/aquila.json'));
    assert.equal(
      $schema,
      '../../.aquila/schema/aquila.schema.json',
      'editor autocompletion',
    );
    const ok = aquila(root, 'check');
    assert.match(ok.out, /✓ docs\/ai\/aquila\.json valid/, 'init config satisfies the schema');
    assert.doesNotMatch(ok.out, /outside the schema/);

    editConfig(root, (c) => {
      c.gates.conditional = { cmd: 'node -e "0"', when: [] };
    });
    const emptyWhen = aquila(root, 'check');
    assert.equal(emptyWhen.code, 1);
    assert.match(emptyWhen.out, /gates\.conditional\.when: define at least one non-empty path pattern/);

    editConfig(root, (c) => {
      c.gates.conditional = { cmd: 'node -e "0"', when: 'legacy note' };
      c.hooks.prepush = ['test']; // typo: warning
      c.mode = 'squad';
      c.ci['node-version'] = 22;
      c.hooks.ci.push('e2e');
    });
    const bad = aquila(root, 'check');
    assert.equal(bad.code, 1);
    assert.match(bad.out, /aquila\.json invalid/);
    assert.match(bad.out, /mode: "squad" is not "local" \| "team"/);
    assert.match(bad.out, /ci\.node-version: expected string, found integer/);
    assert.match(bad.out, /hooks\.ci: gate "e2e" is not in gates/);
    assert.match(bad.out, /keys outside the schema \(typo\?\): hooks\.prepush/);
    assert.match(bad.out, /text `when` in gates conditional does not filter execution/);
  } finally {
    cleanup(root);
  }
});

test('check warns about unfilled docs and missing docs/ folders, without failing', () => {
  const root = project();
  try {
    aquila(root, 'init');
    const fresh = aquila(root, 'check');
    assert.equal(fresh.code, 0, 'a warning, not a failure: aquila-docs has not run yet');
    assert.match(fresh.out, /! docs\/ai\/CONTEXT\.md is still the template → \/aquila-docs/);
    assert.match(fresh.out, /! docs\/ai\/golden\.md is still the template/);
    assert.doesNotMatch(fresh.out, /docs\/ missing/, 'init creates the six folders');

    writeFileSync(join(root, 'docs/ai/CONTEXT.md'), '# CONTEXT\n');
    writeFileSync(join(root, 'docs/ai/golden.md'), '# golden\n');
    rmSync(join(root, 'docs/runbooks'), { recursive: true });
    const out = aquila(root, 'check').out;
    assert.doesNotMatch(out, /still the template/);
    assert.match(out, /! docs\/ missing runbooks/);
  } finally {
    cleanup(root);
  }
});

test('check --ready separates templates from readiness without running gates', () => {
  const root = project();
  try {
    install(root);
    aquila(root, 'init', '--tools=codex', '--lint=off');
    assert.equal(aquila(root, 'check').code, 0);
    const incomplete = aquila(root, 'check', '--ready');
    assert.equal(incomplete.code, 1, incomplete.out);
    assert.match(incomplete.out, /readiness blocked/);
    assert.match(incomplete.out, /CONTEXT\.md.*template/);
    assert.match(incomplete.out, /golden\.md.*template/);

    writeFileSync(join(root, 'docs/ai/CONTEXT.md'), '# Confirmed context\n');
    writeFileSync(join(root, 'docs/ai/golden.md'), '# Real examples\n');
    editConfig(root, (cfg) => {
      cfg.gates = { verify: 'node -e "process.exit(7)"' };
      cfg.hooks = { ci: ['verify'], 'pre-commit': [], 'pre-push': ['verify'] };
    });
    aquila(root, 'sync');
    const ready = aquila(root, 'check', '--ready');
    assert.equal(ready.code, 0, ready.out);
    assert.match(ready.out, /technical readiness verified/);
    assert.match(ready.out, /gates were not run and remote CI was not checked/);
    assert.equal(aquila(root, 'gate', 'ci').code, 1, 'ready does not replace gate ci');

    rmSync(join(root, 'docs/ai/golden.md'));
    assert.match(aquila(root, 'check', '--ready').out, /golden\.md missing/);
    writeFileSync(join(root, 'docs/ai/golden.md'), ' \n');
    assert.match(aquila(root, 'check', '--ready').out, /golden\.md empty/);
    writeFileSync(join(root, 'docs/ai/golden.md'), '# Real examples\n');
    rmSync(join(root, 'docs/runbooks'), { recursive: true });
    assert.match(aquila(root, 'check', '--ready').out, /docs\/ missing runbooks/);
    assert.equal(aquila(root, 'check').code, 0, 'default stays permissive');
  } finally {
    cleanup(root);
  }
});

test('check --ready blocks empty CI, empty commands and pending lint', () => {
  const root = project();
  try {
    install(root);
    aquila(root, 'init', '--tools=codex');
    const pending = aquila(root, 'check', '--ready');
    assert.equal(pending.code, 1);
    assert.match(pending.out, /lint pending/);
    editConfig(root, (cfg) => {
      cfg.lint = { level: 'off' };
      cfg.gates = {};
      cfg.hooks = { ci: [] };
    });
    aquila(root, 'sync');
    assert.match(aquila(root, 'check', '--ready').out, /CI has no project checks/);
    editConfig(root, (cfg) => {
      cfg.gates = { 'lint-aquila': 'npx aquila-react-ai lint', test: { cmd: '  ' } };
      cfg.hooks = { ci: ['test'] };
    });
    const empty = aquila(root, 'check', '--ready');
    assert.equal(empty.code, 1);
    assert.match(empty.out, /gates\.test: empty command/);
    editConfig(root, (cfg) => {
      cfg.gates = { 'lint-aquila': 'npx aquila-react-ai lint' };
      cfg.hooks = { ci: ['lint-aquila'] };
    });
    assert.match(aquila(root, 'check', '--ready').out, /CI has no project checks/);
    const bad = aquila(root, 'check', '--raedy');
    assert.equal(bad.code, 1);
    assert.match(bad.out, /unknown flag.*--raedy/);
  } finally {
    cleanup(root);
  }
});

test('check --ready verifies local adapters, the devDependency and per-phase hooks', () => {
  const root = project();
  try {
    aquila(root, 'init', '--tools=codex', '--lint=off');
    assert.match(aquila(root, 'check', '--ready').out, /aquila-react-ai is not in package\.json/);
    install(root);
    aquila(root, 'sync');
    assert.doesNotMatch(aquila(root, 'check', '--ready').out, /not in package\.json/);
    rmSync(join(root, 'AGENTS.md'));
    assert.match(aquila(root, 'check', '--ready').out, /AGENTS\.md missing/);
    aquila(root, 'sync');
    execFileSync('git', ['config', 'core.hooksPath', '.husky/_'], { cwd: root });
    mkdirSync(join(root, '.husky'), { recursive: true });
    writeFileSync(join(root, '.husky/pre-commit'), 'npx aquila-react-ai gate pre-push\n');
    const wrongPhase = aquila(root, 'check', '--ready');
    assert.match(wrongPhase.out, /pre-commit does not call.*gate pre-commit/);
    assert.match(wrongPhase.out, /pre-push missing/);
    writeFileSync(join(root, '.husky/pre-commit'), 'npx aquila-react-ai gate pre-commit\n');
    writeFileSync(join(root, '.husky/pre-push'), 'npx --no-install aquila-react-ai gate pre-push\n');
    const integrated = aquila(root, 'check', '--ready');
    assert.doesNotMatch(integrated.out, /does not call|pre-push missing/);
    assert.equal(aquila(root, 'check').code, 0);
  } finally {
    cleanup(root);
  }
});

test('check --ready handles malformed configuration without a TypeError', () => {
  const root = project();
  try {
    aquila(root, 'init', '--tools=codex', '--lint=off');
    editConfig(root, (cfg) => {
      cfg.tools = null;
      cfg.hooks = null;
      cfg.gates = null;
    });
    const result = aquila(root, 'check', '--ready');
    assert.equal(result.code, 1);
    assert.match(result.out, /tools: expected array/);
    assert.doesNotMatch(result.out, /Cannot read|TypeError/);
    writeFileSync(join(root, 'docs/ai/aquila.json'), 'null');
    const nullConfig = aquila(root, 'check', '--ready');
    assert.equal(nullConfig.code, 1);
    assert.match(nullConfig.out, /\(root\): expected object/);
    assert.doesNotMatch(nullConfig.out, /Cannot read|TypeError/);
  } finally {
    cleanup(root);
  }
});

test('check --ready requires local Copilot settings but plain check does not', () => {
  const root = project();
  try {
    aquila(root, 'init', '--tools=copilot', '--lint=off');
    rmSync(join(root, '.vscode/settings.json'));
    assert.equal(aquila(root, 'check').code, 0);
    const ready = aquila(root, 'check', '--ready');
    assert.equal(ready.code, 1);
    assert.match(ready.out, /\.vscode\/settings\.json without the aquila-react-ai keys/);
    aquila(root, 'sync');
    assert.doesNotMatch(
      aquila(root, 'check', '--ready').out,
      /\.vscode\/settings\.json without the aquila-react-ai keys/,
    );
  } finally {
    cleanup(root);
  }
});

test('CRLF, links with % and old-format routers do not break check', () => {
  const root = project();
  try {
    aquila(root, 'init', '--mode=team');
    writeFileSync(join(root, 'AGENTS.md'), readIn(root, 'AGENTS.md').replaceAll('\n', '\r\n'));
    assert.equal(aquila(root, 'check').code, 0, 'CRLF (autocrlf) is not drift');

    writeFileSync(join(root, 'docs/ai/golden.md'), '[x](report-100%.md)\n');
    const links = aquila(root, 'check');
    assert.match(links.out, /golden\.md → report-100%\.md/, 'broken link, not "URI malformed"');
    writeFileSync(join(root, 'docs/ai/golden.md'), '# golden\n');

    writeFileSync(
      join(root, 'CLAUDE.md'),
      '<!-- generated by aquila-react-ai (npx aquila-react-ai sync) — do not edit -->\n\n@AGENTS.md\n',
    );
    assert.match(aquila(root, 'check').out, /CLAUDE\.md without the aquila-react-ai block/);
    aquila(root, 'sync');
    assert.match(readIn(root, 'CLAUDE.md'), /^<!-- >>> generated by aquila-react-ai[\s\S]*@AGENTS\.md/);
    assert.doesNotMatch(
      readIn(root, 'CLAUDE.md'),
      /^<!-- generated by aquila-react-ai/m,
      'old format migrated',
    );
  } finally {
    cleanup(root);
  }
});

test('check passes on a freshly initialized project and fails on drift, broken links or budget', () => {
  const root = project();
  try {
    aquila(root, 'init');
    const fresh = aquila(root, 'check');
    assert.equal(fresh.code, 0, fresh.out);
    assert.match(fresh.out, /adapters in sync/);

    writeFileSync(
      join(root, 'AGENTS.md'),
      readIn(root, 'AGENTS.md').replace('instructions for AI agents', 'changed by hand'),
    );
    assert.match(aquila(root, 'check').out, /AGENTS\.md out of date/);
    aquila(root, 'sync');

    writeFileSync(join(root, 'docs/ai/golden.md'), '[x](does-not-exist.md)\n');
    const links = aquila(root, 'check');
    assert.equal(links.code, 1);
    assert.match(links.out, /golden\.md → does-not-exist\.md/);

    writeFileSync(join(root, 'docs/ai/golden.md'), 'x'.repeat(7000));
    assert.match(aquila(root, 'check').out, /golden\.md: 7000 > 6000/);
  } finally {
    cleanup(root);
  }
});

test('gate runs the phase commands and fails with the failure summary', () => {
  const root = project();
  try {
    aquila(root, 'init');
    editConfig(root, (cfg) => {
      cfg.gates = { ok: 'node -e "0"', bad: 'node -e "console.log(\'boom\'); process.exit(3)"' };
      cfg.hooks = { 'pre-commit': ['ok'], ci: ['ok', 'bad'] };
    });
    assert.equal(aquila(root, 'gate', 'pre-commit').code, 0);
    const ci = aquila(root, 'gate', 'ci');
    assert.equal(ci.code, 1);
    assert.match(ci.out, /✗ bad/);
    assert.match(ci.out, /boom/);
    assert.match(ci.out, /1\/2 gates green/);
  } finally {
    cleanup(root);
  }
});

test('CI gate applies when globs to the diff and fails open if it cannot compare', () => {
  for (const [modifiedFile, shouldRun] of [
    ['src/route.ts', true],
    ['docs/README.md', false],
  ]) {
    const root = project({ 'src/route.ts': 'export const route = true;\n' });
    try {
      execFileSync('git', ['config', 'user.name', 'aquila test'], { cwd: root });
      execFileSync('git', ['config', 'user.email', 'aquila-test@example.invalid'], { cwd: root });
      execFileSync('git', ['add', 'src/route.ts'], { cwd: root });
      execFileSync('git', ['commit', '-m', 'base'], { cwd: root, stdio: 'ignore' });
      const base = git(root, 'rev-parse', 'HEAD');
      assert.match(base, /^[0-9a-f]{40,64}$/i);

      mkdirSync(join(root, 'docs'), { recursive: true });
      writeFileSync(join(root, modifiedFile), 'changed\n');
      execFileSync('git', ['add', modifiedFile], { cwd: root });
      execFileSync('git', ['commit', '-m', 'change'], { cwd: root, stdio: 'ignore' });
      const head = git(root, 'rev-parse', 'HEAD');
      const eventPath = join(root, 'event.json');
      writeFileSync(
        eventPath,
        JSON.stringify({ pull_request: { base: { sha: base }, head: { sha: head } } }),
      );
      aquila(root, 'init');
      editConfig(root, (cfg) => {
        cfg.gates = {
          e2e: {
            cmd: `node -e "require('node:fs').writeFileSync('gate-ran.txt', 'yes')"`,
            when: ['src/**/*.ts'],
          },
        };
        cfg.hooks = { ci: ['e2e'], 'pre-commit': ['e2e'] };
      });

      const env = { GITHUB_EVENT_PATH: eventPath, GITHUB_SHA: head };
      const ci = aquilaWithEnv(root, env, 'gate', 'ci');
      assert.equal(ci.code, 0, ci.out);
      assert.equal(existsSync(join(root, 'gate-ran.txt')), shouldRun);
      if (shouldRun) assert.match(ci.out, /1\/1 gates green \(ci\)/);
      else {
        assert.match(ci.out, /no changed file matches src\/\*\*\/\*\.ts/);
        assert.match(ci.out, /0\/0 gates green \(ci\); 1 skipped/);
      }

      rmSync(join(root, 'gate-ran.txt'), { force: true });
      const local = aquilaWithEnv(root, env, 'gate', 'pre-commit');
      assert.equal(local.code, 0, local.out);
      assert.equal(existsSync(join(root, 'gate-ran.txt')), true, 'local hooks ignore when');

      rmSync(join(root, 'gate-ran.txt'), { force: true });
      const fallback = aquilaWithEnv(root, { GITHUB_EVENT_PATH: '' }, 'gate', 'ci');
      assert.equal(fallback.code, 0, fallback.out);
      assert.match(fallback.out, /conditional gates run to be safe/);
      assert.equal(existsSync(join(root, 'gate-ran.txt')), true);
    } finally {
      cleanup(root);
    }
  }
});

test('runs from node_modules/aquila-react-ai (a link) using the current directory, without AQUILA_ROOT', () => {
  const root = project();
  try {
    const env = { ...process.env };
    delete env.AQUILA_ROOT;
    const r = spawnSync(
      process.execPath,
      [join('node_modules', 'aquila-react-ai', 'bin', 'aquila.mjs'), 'init'],
      { cwd: root, env, encoding: 'utf8' },
    );
    assert.equal(r.status, 0, r.stderr);
    assert.match(readIn(root, 'AGENTS.md'), /generated by aquila-react-ai/);
  } finally {
    cleanup(root);
  }
});

test('gate: CI without gates fails; an empty local hook passes; a missing tool gives a hint', () => {
  const root = project({ 'x.txt': '' }, { node: false });
  try {
    aquila(root, 'init');
    const ci = aquila(root, 'gate', 'ci');
    assert.equal(ci.code, 1);
    assert.match(ci.out, /CI cannot pass without checking anything/);
    assert.equal(aquila(root, 'gate', 'pre-commit').code, 0);

    editConfig(root, (c) => {
      c.gates = { tool: 'tool-that-does-not-exist-aquila --version' };
      c.hooks = { ci: ['tool'] };
    });
    assert.match(aquila(root, 'gate', 'ci').out, /this gate's tool seems not to be installed/);
  } finally {
    cleanup(root);
  }
});

test('CI workflow uses the project install command and Node runtime', () => {
  const pnpm = project({ 'pnpm-lock.yaml': '' });
  const npm = project({ 'package-lock.json': '{}' });
  const yarn = project({ 'yarn.lock': '' });
  try {
    install(pnpm);
    aquila(pnpm, 'init');
    const pnpmCaller = readIn(pnpm, '.github/workflows/aquila-gates.yml');
    assert.match(pnpmCaller, /node-version: '22'/);
    assert.match(pnpmCaller, /- run: corepack enable && pnpm install --frozen-lockfile\n/);
    assert.doesNotMatch(pnpmCaller, /cache:/, 'pnpm: corepack only runs after setup-node');

    const bad = aquila(npm, 'init', '--tools');
    assert.equal(bad.code, 1);
    assert.match(bad.out, /--tools needs a value/);
    install(npm);
    aquila(npm, 'init');
    const npmCaller = readIn(npm, '.github/workflows/aquila-gates.yml');
    assert.match(npmCaller, /cache: 'npm'/);
    assert.match(npmCaller, /- run: npm ci\n/);

    install(yarn);
    aquila(yarn, 'init');
    assert.match(
      readIn(yarn, '.github/workflows/aquila-gates.yml'),
      /- run: corepack enable && yarn install --immutable\n/,
    );
  } finally {
    cleanup(pnpm);
    cleanup(npm);
    cleanup(yarn);
  }
});

test('ciCaller: self-contained workflow, quoted values, optional install', () => {
  const minimal = ciCaller({});
  assert.match(minimal, /^# Generated by `npx aquila-react-ai sync`/);
  assert.match(minimal, /node-version: '22'/);
  assert.doesNotMatch(minimal, /cache:|- run: (?!npx)/);
  assert.doesNotMatch(minimal, /uses: (?!actions\/)/, 'no reusable workflow');
  const custom = ciCaller({
    ci: { 'node-version': "24'x", cache: 'npm', 'install-command': 'npm ci' },
  });
  assert.match(custom, /node-version: '24''x'/);
  assert.match(custom, /cache: 'npm'/);
  assert.ok(custom.indexOf('- run: npm ci') < custom.indexOf('npx aquila-react-ai check'));
});

test('doctor: gate in no phase and husky hooks that do not call aquila-react-ai gate', () => {
  const root = project();
  try {
    aquila(root, 'init');
    editConfig(root, (c) => {
      c.gates['lint-aquila'] = 'npx aquila-react-ai lint';
      c.hooks['pre-push'] = ['test'];
      c.hooks.ci = ['test'];
    });
    mkdirSync(join(root, '.husky/_'), { recursive: true });
    writeFileSync(join(root, '.husky/pre-push'), 'npm run typecheck && npm run test:changed\n');
    writeFileSync(join(root, '.husky/pre-commit'), 'npx lint-staged\n');
    git(root, 'config', 'core.hooksPath', '.husky/_');
    const { out } = aquila(root, 'doctor');
    assert.match(out, /! gate lint-aquila in no phase/);
    assert.match(out, /! \.husky\/pre-push does not call `npx aquila-react-ai gate pre-push`/);
    assert.match(out, /! \.husky\/pre-commit does not call/, 'lint-staged outside hooks.pre-commit');
    assert.match(out, /✗ aquila-react-ai not in package\.json → npm i -D aquila-react-ai/);

    writeFileSync(join(root, '.husky/pre-push'), 'npx aquila-react-ai gate pre-push\n');
    install(root);
    const after = aquila(root, 'doctor').out;
    assert.doesNotMatch(after, /\.husky\/pre-push/);
    assert.match(after, /✓ aquila-react-ai in package\.json/);
  } finally {
    cleanup(root);
  }
});
