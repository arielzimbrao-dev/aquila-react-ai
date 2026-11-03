// aquila-react-ai ESLint flat config. Reads the level from docs/ai/aquila.json (lint.level) and resolves plugins
// from the project (not from aquila-react-ai), so the plugins are the project's own devDependencies:
//   npx eslint --config .aquila/lint/eslint/eslint.config.mjs --max-warnings=0 .
// `npx aquila-react-ai lint` runs exactly this. AQUILA_ROOT / AQUILA_LINT_LEVEL override (tests).
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEFAULT_CONFIG_PATHS } from '../../bin/aquila.mjs';
import { buildEslintConfig } from './build.mjs';
import { loadEslintPlugins } from './plugins.mjs';

const root = resolve(process.env.AQUILA_ROOT ?? process.cwd());
const cfg = existsSync(join(root, 'docs/ai/aquila.json'))
  ? JSON.parse(readFileSync(join(root, 'docs/ai/aquila.json'), 'utf8'))
  : {};
const level = process.env.AQUILA_LINT_LEVEL ?? cfg.lint?.level ?? 'standard';
const catalog = JSON.parse(readFileSync(new URL('../rules.json', import.meta.url), 'utf8'));
const plugins = await loadEslintPlugins(root);

const { config, missing } = buildEslintConfig(catalog, {
  level,
  root,
  srcDirs: cfg.srcDirs ?? ['src'],
  testGlobs: cfg.lint?.testGlobs,
  testDirs: cfg.testDirs,
  configPaths: cfg.lint?.options?.configPaths ?? DEFAULT_CONFIG_PATHS,
  ticketPattern: cfg.lint?.options?.ticketPattern,
  aliases: cfg.lint?.options?.aliases,
  plugins,
});
if (missing.length) {
  console.warn(
    `aquila-react-ai lint (${level}): rules skipped — install in the project: npm i -D ${missing
      .map(
        (m) =>
          ({
            sonarjs: 'eslint-plugin-sonarjs',
            unicorn: 'eslint-plugin-unicorn',
            jest: 'eslint-plugin-jest',
            react: 'eslint-plugin-react',
            'react-hooks': 'eslint-plugin-react-hooks',
            'jsx-a11y': 'eslint-plugin-jsx-a11y',
          })[m] ?? m,
      )
      .join(' ')}`,
  );
}

export default config;
