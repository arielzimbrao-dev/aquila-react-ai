import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { globToRegex } from './glob.mjs';
import { missingTool } from './lint.mjs';

const DOC_DIRS = ['ai', 'c4', 'adr', 'tracks', 'reference', 'runbooks'];
export const TEMPLATE_MARKS = {
  'docs/ai/CONTEXT.md': '(to fill in)',
  'docs/ai/golden.md': '<Type, e.g.:',
};
const LINK = /\]\(([^)\s]+)\)/g;
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|#)/i;
const read = (root, file) => readFileSync(join(root, file), 'utf8');

export function docWarnings(root) {
  const missing = DOC_DIRS.filter(
    (dir) =>
      !existsSync(join(root, 'docs', dir)) || !statSync(join(root, 'docs', dir)).isDirectory(),
  );
  const unfilled = Object.entries(TEMPLATE_MARKS)
    .filter(([file, mark]) => existsSync(join(root, file)) && read(root, file).includes(mark))
    .map(([file]) => file);
  return [
    ...(missing.length
      ? [
          `! docs/ missing ${missing.join(', ')} (.aquila/core/docs.md) → npx aquila-react-ai init`,
        ]
      : []),
    ...unfilled.map((file) => `! ${file} is still the template → /aquila-docs`),
  ];
}

export function inspectDocuments({ root, cfg, walk, routers, instructions, budgets, frontmatter }) {
  const files = [
    ...walk('docs', (file) => file.endsWith('.md')),
    ...walk('.github', (file) => file.endsWith('.md')),
    ...routers.filter((file) => existsSync(join(root, file))),
    ...['README.md'].filter((file) => existsSync(join(root, file))),
  ];
  const broken = [];
  for (const file of files) {
    const text = read(root, file).replaceAll(/```[\s\S]*?```/g, '');
    for (const [, target] of text.matchAll(LINK)) {
      if (EXTERNAL.test(target)) continue;
      let path;
      try {
        path = decodeURIComponent(target.split('#')[0]);
      } catch {
        path = target.split('#')[0];
      }
      if (path && !existsSync(resolve(root, file, '..', path))) broken.push(`${file} → ${target}`);
    }
  }
  const candidates = [
    ...walk('docs/ai'),
    ...walk(instructions),
    ...routers.filter((file) => existsSync(join(root, file))),
  ];
  const over = [];
  for (const [glob, max] of Object.entries({ ...budgets, ...cfg.budgets })) {
    const re = globToRegex(glob);
    for (const file of candidates.filter((candidate) => re.test(candidate))) {
      // CRLF (autocrlf) is not content.
      const size = read(root, file).replaceAll('\r\n', '\n').length;
      if (size > max) over.push(`${file}: ${size} > ${max}`);
    }
  }
  const rules = walk(instructions, (file) => file.endsWith('.instructions.md')).flatMap((file) =>
    (frontmatter(read(root, file)).applyTo ?? '').split(',').filter(Boolean).map(globToRegex),
  );
  const uncovered = rules.length
    ? (cfg.srcDirs ?? [])
        .flatMap((dir) => walk(dir))
        .filter((file) => !rules.some((re) => re.test(file)))
    : [];
  return { files: files.length, broken, over, uncovered };
}

/** Verifiable readiness, without running project commands or judging the docs semantically. */
export function readinessIssues(root, cfg) {
  const issues = docWarnings(root).map((warning) => warning.slice(2));
  for (const file of Object.keys(TEMPLATE_MARKS)) {
    if (!existsSync(join(root, file))) issues.push(`${file} missing → /aquila-docs`);
    else if (!read(root, file).trim()) issues.push(`${file} empty → /aquila-docs`);
  }
  const command = (gate) => (typeof gate === 'string' ? gate : gate?.cmd);
  for (const [name, gate] of Object.entries(cfg.gates)) {
    if (!command(gate)?.trim())
      issues.push(`gates.${name}: empty command → define a real check`);
  }
  const ci = cfg.hooks.ci ?? Object.keys(cfg.gates);
  if (!ci.some((name) => name !== 'lint-aquila' && command(cfg.gates[name])?.trim()))
    issues.push('CI has no project checks → configure gates and hooks.ci');
  if (cfg.lint?.level && cfg.lint.level !== 'off') {
    const missing = cfg.lint.pending || missingTool(cfg.lint.engine, root);
    if (missing) issues.push(`lint pending: ${missing} → install the engine and run sync`);
    else if (cfg.lint.engine && !ci.includes('lint-aquila'))
      issues.push('lint-aquila not in CI → run sync and add it to hooks.ci');
  }
  return issues;
}

export function hookIssues(root, cfg, hooksPath) {
  const issues = [];
  const dir = (hooksPath || '.git/hooks').replace(/[\\/]_[\\/]?$/, '');
  for (const phase of ['pre-commit', 'pre-push']) {
    if (!(cfg.hooks[phase] ?? []).length) continue;
    const file = resolve(root, dir, phase);
    if (!existsSync(file)) {
      issues.push(`${dir}/${phase} missing → call gate ${phase} from your hook manager`);
      continue;
    }
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    const shell =
      !lines[0].startsWith('#!') ||
      /^#!(?:\/bin\/(?:ba)?sh|\/usr\/bin\/env (?:ba)?sh)\s*$/.test(lines[0]);
    const text = lines
      .filter((line) => line.trim() && !/^\s*#/.test(line))
      .join('\n')
      .trim();
    // Only a direct delegation proves the exit code propagates, without interpreting/running shell.
    const path = String.raw`(?:\.\/)?node_modules/aquila-react-ai/bin/aquila\.mjs`;
    const script = String.raw`(?:${path}|"${path}"|'${path}'|"\$\(git rev-parse --show-toplevel\)/node_modules/aquila-react-ai/bin/aquila\.mjs")`;
    const call = new RegExp(
      `^(?:exec[ \\t]+)?(?:node[ \\t]+${script}|npx(?:[ \\t]+--no(?:-install)?)?[ \\t]+aquila-react-ai)[ \\t]+gate[ \\t]+${phase}$`,
    );
    if (!shell || !call.test(text))
      issues.push(
        `${dir}/${phase} does not call \`npx aquila-react-ai gate ${phase}\` in a directly verifiable way — integration unverified (review complex hooks manually)`,
      );
  }
  return issues;
}
