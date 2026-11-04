// aquila-react-ai ESLint flat config. Reads the level from docs/ai/aquila.json (lint.level) and resolves plugins
// from the project (not from aquila-react-ai), so the plugins are the project's own devDependencies:
//   npx eslint --config .aquila/lint/eslint/eslint.config.mjs --max-warnings=0 .
// `npx aquila-react-ai lint` runs exactly this. AQUILA_ROOT / AQUILA_LINT_LEVEL override (tests).
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PLUGIN_PACKAGES } from '../../bin/lint.mjs';
import { loadPreset } from '../../bin/stack.mjs';
import { buildEslintConfig } from './build.mjs';
import { loadEslintPlugins } from './plugins.mjs';

const root = resolve(process.env.AQUILA_ROOT ?? process.cwd());
const cfg = existsSync(join(root, 'docs/ai/aquila.json'))
  ? JSON.parse(readFileSync(join(root, 'docs/ai/aquila.json'), 'utf8'))
  : {};
const level = process.env.AQUILA_LINT_LEVEL ?? cfg.lint?.level ?? 'standard';
const catalog = JSON.parse(readFileSync(new URL('../rules.json', import.meta.url), 'utf8'));
const plugins = await loadEslintPlugins(root);

const { config, missing, unknown } = buildEslintConfig(catalog, {
  level,
  root,
  srcDirs: cfg.srcDirs ?? ['src'],
  testGlobs: cfg.lint?.testGlobs,
  testDirs: cfg.testDirs,
  configPaths: cfg.lint?.options?.configPaths ?? loadPreset().configPaths,
  ticketPattern: cfg.lint?.options?.ticketPattern,
  aliases: cfg.lint?.options?.aliases,
  overrides: cfg.lint?.overrides,
  plugins,
});
if (missing.length) {
  console.warn(
    `aquila-react-ai lint (${level}): rules skipped — install in the project: npm i -D ${missing.map((m) => PLUGIN_PACKAGES[m] ?? (m === 'typescript-eslint' ? m : `eslint-plugin-${m}`)).join(' ')}`,
  );
}

if (unknown.length)
  console.warn(
    `aquila-react-ai lint (${level}): rules not in the installed plugin versions, skipped: ${unknown.join(', ')} (npx aquila-react-ai doctor)`,
  );

export default config;
