import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { PKG, CLI, project, cleanup } from './helpers.mjs';
import { hookIssues } from '../bin/checks.mjs';

test('guard: blocks git skipping hooks or force push, but not text that mentions them', async () => {
  const { blocked } = await import(pathToFileURL(join(PKG, 'hooks/guard-bash.mjs')).href);
  // Built at runtime so the guard itself does not block whoever edits this file.
  const skip = ['--no', 'verify'].join('-');
  const push = ['git', 'push'].join(' ');
  for (const cmd of [
    `git commit -m x ${skip}`,
    `wsl bash -ic 'cd repo && ${push} ${skip}'`,
    `${push} -f origin x`,
    `${push} --force origin x`,
  ]) {
    assert.ok(blocked(cmd), cmd);
  }
  for (const cmd of [
    `echo "never ${skip}" > AGENTS.md`,
    `grep -n -- "${skip}" docs/*.md`,
    `sed -i 's#x#never ${skip}#' core/done.md && git add core/done.md`,
    `${push} --force-with-lease`,
    'git fetch -f',
    'npm test',
  ]) {
    assert.equal(blocked(cmd), null, cmd);
  }
});

test('git hooks delegate to the installed package and are versioned as executables', (t) => {
  // The shipped hooks must pass the same direct-delegation check that check --ready applies.
  const cfg = { hooks: { 'pre-commit': ['x'], 'pre-push': ['x'] } };
  assert.deepEqual(hookIssues(PKG, cfg, 'githooks'), []);
  for (const phase of ['pre-commit', 'pre-push']) {
    const text = readFileSync(join(PKG, 'githooks', phase), 'utf8');
    assert.ok(!text.includes('\r\n'), `${phase}: sh breaks with CRLF`);
    assert.match(
      text,
      new RegExp(
        `exec node "\\$\\(git rev-parse --show-toplevel\\)/node_modules/aquila-react-ai/bin/aquila\\.mjs" gate ${phase}`,
      ),
    );
  }
  // Linux/macOS ignore hooks without +x; only verifiable when the package is a git checkout.
  let modes;
  try {
    modes = execFileSync('git', ['ls-files', '-s', 'githooks'], {
      cwd: PKG,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    modes = '';
  }
  if (!modes) return t.skip('package is not a git checkout');
  for (const line of modes.split('\n')) assert.match(line, /^100755 /, line);
});

test('guard: also catches -n, -c core.hooksPath and + refspec', async () => {
  const { blocked } = await import(pathToFileURL(join(PKG, 'hooks/guard-bash.mjs')).href);
  const g = 'git';
  for (const cmd of [
    `${g} commit -n -m x`,
    `${g} commit -anm x`,
    `${g} -c core.hooksPath=/dev/null commit -m x`,
    `${g} push origin +main`,
    `${g} config core.hooksPath /dev/null`,
    `${g} config --local core.hooksPath ''`,
    `${g} config --unset core.hooksPath`,
  ]) {
    assert.ok(blocked(cmd), cmd);
  }
  for (const cmd of [
    `${g} commit -m x`,
    `${g} commit -am x`,
    `${g} push origin main`,
    `${g} log --grep=commit -n 5`,
    `${g} commit -m "update -nodes"`,
    `${g} commit -am 'fix -n flag'`,
    `${g} log --format=push -f x`,
    `${g} config core.hooksPath .aquila/githooks`,
    `${g} config --get core.hooksPath`,
    `${g} config core.hooksPath .husky/_`,
    `${g} config core.hooksPath .husky`,
  ]) {
    assert.equal(blocked(cmd), null, cmd);
  }
});

test('guard: husky disabled via environment variable, and shell comments', async () => {
  const { blocked } = await import(pathToFileURL(join(PKG, 'hooks/guard-bash.mjs')).href);
  const g = 'git';
  const skip = ['--no', 'verify'].join('-');
  for (const cmd of [
    `HUSKY=0 ${g} commit -m x`,
    `HUSKY_SKIP_HOOKS=1 ${g} push origin main`,
    `export HUSKY=0 && ${g} commit -m x`,
    `$env:HUSKY=0; ${g} commit -m x`,
    `$env:HUSKY = '0'\n${g} push`,
    `ls # nothing\n${g} commit ${skip}`,
  ]) {
    assert.ok(blocked(cmd), cmd);
  }
  for (const cmd of [
    `HUSKY=0 npm ci`,
    `echo "HUSKY=0" && ${g} status`,
    `${g} commit -m "HUSKY=0 explained"`,
    `${g} status # later: ${g} commit ${skip}`,
    `${g} commit -m "fix # 12" && ${g} push`,
  ]) {
    assert.equal(blocked(cmd), null, cmd);
  }
});

test('guard: stdin that is not JSON exits 0 silently', () => {
  const r = spawnSync(process.execPath, [join(PKG, 'hooks/guard-bash.mjs')], {
    input: 'this is not json',
    encoding: 'utf8',
  });
  assert.equal(r.status, 0);
  assert.equal(r.stderr, '');
  const hit = spawnSync(process.execPath, [join(PKG, 'hooks/guard-bash.mjs')], {
    input: JSON.stringify({ tool_input: { command: `HUSKY=0 ${'git'} commit -m x` } }),
    encoding: 'utf8',
  });
  assert.equal(hit.status, 2);
});

test('init: validates flags, accepted values and tool lists', async () => {
  const { LANGUAGES, nodeVersionSupported, parseOpts } = await import(pathToFileURL(CLI).href);
  assert.equal(nodeVersionSupported('18.20.8'), false);
  assert.equal(nodeVersionSupported('21.7.3'), false);
  assert.equal(nodeVersionSupported('22.0.0'), true);
  assert.equal(nodeVersionSupported('24.10.0'), true);
  assert.equal(nodeVersionSupported('26.0.0'), true);
  assert.deepEqual(LANGUAGES, ['en', 'pt-BR', 'pt-PT']);
  assert.throws(() => parseOpts(['--lnag=en']), /unknown flag: --lnag=en/);
  assert.throws(() => parseOpts(['--lang']), /--lang needs a value/);
  assert.deepEqual(
    parseOpts([
      '--lang=en',
      '--tools=claude,codex',
      '--token-limit=1000',
      '--mode=team',
      '--lint=high',
      '--pr-max-files=12',
    ]),
    {
      lang: 'en',
      tools: ['claude', 'codex'],
      tokenLimit: 1000,
      mode: 'team',
      lint: 'high',
      prMaxFiles: 12,
    },
  );
  for (const lang of LANGUAGES) assert.deepEqual(parseOpts([`--lang=${lang}`]), { lang });
  for (const args of [
    ['--lang=xx'],
    ['--lang=pt'],
    ['--tools=wat'],
    ['--tools=copilot,'],
    ['--tools=copilot,copilot'],
    ['--mode=teamish'],
    ['--lint=maximum'],
    ['--token-limit=Infinity'],
    ['--token-limit=12=34'],
    ['--pr-max-files=0'],
    ['--pr-max-files=1.5'],
    ['--pr-max-files=x'],
  ]) {
    assert.throws(() => parseOpts(args), Error, args.join(' '));
  }
});

test('version: --version and version() match package.json', async () => {
  const { version } = await import(pathToFileURL(CLI).href);
  const pkg = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8'));
  assert.equal(version(), pkg.version);
  const r = spawnSync(process.execPath, [CLI, '--version'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), pkg.version);
  const usage = spawnSync(process.execPath, [CLI, 'nope'], { encoding: 'utf8' });
  assert.equal(usage.status, 1);
  assert.match(usage.stdout, /usage: npx aquila-react-ai <command>/);
  assert.match(usage.stdout, /--lang=en\|pt-BR\|pt-PT/);
  assert.match(usage.stdout, /--pr-max-files=<n>/);
  assert.equal(spawnSync(process.execPath, [CLI, '--help'], { encoding: 'utf8' }).status, 0);
});

test('reactMajor: installed react wins over the declared range; null without React', async () => {
  const { reactMajor } = await import(pathToFileURL(CLI).href);
  const root = project();
  const bare = project({}, { node: false });
  try {
    assert.equal(reactMajor(root), 19, 'range ^19.0.0 from package.json');
    const installed = join(root, 'node_modules/react');
    mkdirSync(installed, { recursive: true });
    writeFileSync(join(installed, 'package.json'), JSON.stringify({ version: '18.3.1' }));
    assert.equal(reactMajor(root), 18, 'installed version first');
    assert.equal(reactMajor(bare), null);
  } finally {
    cleanup(root);
    cleanup(bare);
  }
});

test('workflows: tests run on Ubuntu and Windows; release tests and checks versions before publishing', () => {
  const tests = readFileSync(join(PKG, '.github', 'workflows', 'test.yml'), 'utf8');
  assert.match(tests, /os: \[ubuntu-latest, windows-latest\]/);
  assert.match(tests, /node: \['22', '24'\]/);
  assert.match(tests, /run: node --test test\/\*\.test\.mjs/);
  const release = readFileSync(join(PKG, '.github', 'workflows', 'release.yml'), 'utf8');
  assert.match(release, /tags: \['v\*\.\*\.\*'\]/);
  const run = release.indexOf('node --test test/*.test.mjs');
  const versions = release.indexOf('.claude-plugin/plugin.json');
  const publish = release.indexOf('npm publish');
  assert.ok(run >= 0 && run < versions && versions < publish, 'tests → versions → publish');
});

test('skills: name equals folder, description ≤ 300 chars and listed in always.md', () => {
  const always = readFileSync(join(PKG, 'core', 'always.md'), 'utf8');
  for (const dir of readdirSync(join(PKG, 'skills'))) {
    const head = readFileSync(join(PKG, 'skills', dir, 'SKILL.md'), 'utf8').split('---')[1];
    assert.match(head, new RegExp(`^name: ${dir}$`, 'm'), dir);
    const desc = head
      .split(/^description:\s*(?:>-)?/m)[1]
      .split('\n')
      .map((l) => l.trim())
      .join(' ')
      .trim();
    assert.ok(desc.length > 0 && desc.length <= 300, `${dir}: ${desc.length}`);
    assert.ok(always.includes(`\`${dir}\``), `${dir} missing from always.md`);
  }
});

test('aquila-init integrates docs and validation before routing to the first plan', () => {
  const skill = readFileSync(join(PKG, 'skills', 'aquila-init', 'SKILL.md'), 'utf8');
  const inventory = skill.indexOf('## 1. Inventory');
  const questions = skill.indexOf('## 2. Confirm');
  const install = skill.indexOf('## 3. Install');
  const docs = skill.indexOf('## 4. Document');
  const validation = skill.indexOf('## 5. Validate');
  const close = skill.indexOf('## 6. Close');
  assert.ok(inventory >= 0 && inventory < questions && questions < install);
  assert.ok(install < docs && docs < validation && validation < close);
  assert.match(skill.slice(docs, validation), /\]\(\.\.\/aquila-docs\/SKILL\.md\)/);
  assert.match(skill.slice(docs, validation), /without asking.*another command/);
  for (const command of ['sync', 'doctor', 'check', 'check --ready', 'gate ci'])
    assert.ok(skill.slice(validation, close).includes(`npx aquila-react-ai ${command}`), command);
  assert.match(skill.slice(close), /Incomplete/);
  assert.match(skill.slice(close), /\/aquila-plan/);
  assert.doesNotMatch(skill, /routes to.*aquila-config/);
  const router = readFileSync(join(PKG, 'core', 'always.md'), 'utf8');
  assert.doesNotMatch(router, /`aquila-init` → `aquila-docs` → `aquila-audit`/);
});
