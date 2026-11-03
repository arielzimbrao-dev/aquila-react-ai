import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..');
const ESLINT_BIN = 'node_modules/eslint/bin/eslint.js';
export const LINT_LEVELS = { off: [], standard: ['standard'], high: ['standard', 'high'] };
const posix = (path) => path.split('\\').join('/');

/** Catalog rules for a level (standard ⊂ high). */
export function lintRules(level) {
  const catalog = JSON.parse(readFileSync(join(PKG, 'lint', 'rules.json'), 'utf8'));
  return catalog.rules.filter((r) => (LINT_LEVELS[level] ?? []).includes(r.level));
}

export function missingTool(engine, root) {
  if (engine === 'eslint' && !existsSync(join(root, ESLINT_BIN))) {
    return 'ESLint is not installed in the project — npm i -D eslint typescript-eslint eslint-plugin-react-hooks eslint-plugin-react eslint-plugin-jsx-a11y (+ eslint-plugin-sonarjs eslint-plugin-unicorn eslint-plugin-jest for level high), or lint.level = off';
  }
  return null;
}

/** An available engine does not prove every catalog rule is active. */
export function lintSummary(level, engine, root) {
  if (level === 'off') return 'lint off';
  const rules = lintRules(level);
  if (!engine) return `lint ${level}: ${rules.length} guidance rules (review/Sonar); no local engine`;
  const missing = missingTool(engine, root);
  if (missing) return `lint ${level}: engine ${engine} pending — ${missing}`;
  return `lint ${level} (${engine}): engine available; see lint rules for the local configuration and lint matrix for the catalog`;
}

async function rulesText(level, engine, root, cfg) {
  const rules = lintRules(level);
  if (!rules.length) return `lint ${level}: no rules.`;
  const missing = missingTool(engine, root);
  let coverage = [];
  if (engine === 'eslint' && !missing) {
    const { buildEslintConfig } = await import('../lint/eslint/build.mjs');
    const { loadEslintPlugins } = await import('../lint/eslint/plugins.mjs');
    coverage = buildEslintConfig(
      { rules },
      {
        level,
        root,
        srcDirs: cfg.srcDirs ?? ['src'],
        testDirs: cfg.testDirs,
        testGlobs: cfg.lint?.testGlobs,
        configPaths: cfg.lint?.options?.configPaths,
        ticketPattern: cfg.lint?.options?.ticketPattern,
        aliases: cfg.lint?.options?.aliases,
        plugins: await loadEslintPlugins(root),
      },
    ).coverage;
  }
  const lines = rules.map((r) => {
    let local = ' (review/Sonar)';
    if (engine && r.enforce?.[engine]?.length) {
      if (missing) local = ' (engine pending; review)';
      else {
        const status = coverage.find((entry) => entry.id === r.id);
        local = status.pending.length
          ? ` (${status.configured ? 'partial' : 'no active rule'}: missing ${status.pending.join(', ')})`
          : ' (configured)';
      }
    }
    return `- ${r.id}${r.sonar ? ` [Sonar ${r.sonar}]` : ''} ${r.title}${local} — ${r.why}`;
  });
  return `aquila-react-ai quality rules — level ${level} (${rules.length}; configuration state, does not confirm execution or semantic coverage):\n${missing ? `! ${missing}\n` : ''}${lines.join('\n')}`;
}

async function matrixText(level) {
  const rules = lintRules(level);
  if (!rules.length) return `lint ${level}: no rules.`;
  const { pluginName } = await import('../lint/eslint/plugins.mjs');
  const rows = rules.map((rule) => {
    const eslint = (rule.enforce?.eslint ?? []).map(
      (entry) => entry.preset ?? pluginName(entry.rule) ?? 'core/local',
    );
    return `| ${rule.id} | ${[...new Set(eslint)].join(', ') || 'review/Sonar'} |`;
  });
  return [
    `Catalog capability — level ${level}; not an execution report.`,
    '| Rule | ESLint (required plugins) |',
    '|---|---|',
    ...rows,
    'Local mappings do not prove semantic equivalence to the principle or to Sonar. Use lint rules for the plugins on this machine.',
  ].join('\n');
}

export function lint(args, { root, loadConfig }) {
  const cfg = loadConfig();
  const opts = {};
  for (const arg of args) {
    if (arg.startsWith('--level=')) opts.level = arg.slice('--level='.length);
    else if (!['rules', 'matrix'].includes(arg))
      throw new Error(`unknown lint argument: ${arg} (use rules, matrix or --level=…)`);
  }
  const level = opts.level ?? cfg.lint?.level ?? 'off';
  if (!Object.hasOwn(LINT_LEVELS, level)) throw new Error('--level is off, standard or high');
  const engine = cfg.lint?.engine ?? null;
  if (args.includes('rules') && args.includes('matrix'))
    throw new Error('choose lint rules or lint matrix, not both');
  if (args.includes('rules') || args.includes('matrix')) {
    const text = args.includes('matrix') ? matrixText(level) : rulesText(level, engine, root, cfg);
    return text.then((value) => (console.log(value), 0));
  }
  if (level === 'off') {
    console.log('lint off (docs/ai/aquila.json → lint.level = off)');
    return 0;
  }
  if (engine !== 'eslint') {
    console.log(
      `no local lint engine: ${level} rules apply via aquila-review and Sonar (npx aquila-react-ai lint rules)`,
    );
    return 0;
  }
  const missing = missingTool(engine, root);
  if (missing) {
    console.error(`✗ ${missing}`);
    return 1;
  }
  const dirs = [...(cfg.srcDirs ?? ['src']), ...(cfg.testDirs ?? ['test'])].filter((d) =>
    existsSync(join(root, d)),
  );
  const config = posix(relative(root, join(PKG, 'lint', 'eslint', 'eslint.config.mjs')));
  const result = spawnSync(
    process.execPath,
    [
      join(root, ESLINT_BIN),
      '--config',
      config,
      '--max-warnings=0',
      '--cache',
      '--cache-location',
      'node_modules/.cache/aquila-eslint',
      ...dirs,
    ],
    {
      cwd: root,
      shell: false,
      stdio: 'inherit',
      env: { ...process.env, AQUILA_ROOT: root, AQUILA_LINT_LEVEL: level },
    },
  );
  if (result.error) console.error(`✗ eslint: ${result.error.message}`);
  else if (result.signal) console.error(`✗ eslint: killed by ${result.signal}`);
  return result.status ?? 1;
}

/** lint-aquila complements the project's gates; it is never the only CI check. */
export function addLintGate(gates, hooks) {
  if (!Object.keys(gates).length || gates['lint-aquila']) return false;
  gates['lint-aquila'] = 'npx aquila-react-ai lint';
  hooks['pre-push'] = [...(hooks['pre-push'] ?? []), 'lint-aquila'];
  hooks.ci = [...(hooks.ci ?? []), 'lint-aquila'];
  return true;
}
