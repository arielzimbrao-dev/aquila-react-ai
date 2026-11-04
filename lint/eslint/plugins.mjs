import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROFILE } from '../../bin/profile.mjs';

// The stack's own plugins (react, react-hooks, jsx-a11y for React) come from the profile: a NestJS project
// never loads them.
const STACK = Object.fromEntries(Object.keys(PROFILE.lint.plugins).map((k) => [k, k]));

export const PLUGIN_OF = {
  '@typescript-eslint': 'typescript-eslint',
  sonarjs: 'sonarjs',
  unicorn: 'unicorn',
  jest: 'jest',
  aquila: 'aquila',
  ...STACK,
};

const PACKAGES = {
  'typescript-eslint': 'typescript-eslint',
  sonarjs: 'eslint-plugin-sonarjs',
  unicorn: 'eslint-plugin-unicorn',
  jest: 'eslint-plugin-jest',
  ...PROFILE.lint.plugins,
  prettier: 'eslint-config-prettier/flat',
};

export const pluginName = (rule) =>
  rule.includes('/') ? PLUGIN_OF[rule.slice(0, rule.lastIndexOf('/'))] : null;

export async function loadEslintPlugins(root) {
  const requireFromProject = createRequire(join(root, 'package.json'));
  const plugins = {};
  for (const [name, pkg] of Object.entries(PACKAGES)) {
    let path;
    try {
      path = requireFromProject.resolve(pkg);
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
      plugins[name] = null;
      continue;
    }
    try {
      const loaded = await import(pathToFileURL(path).href);
      plugins[name] = loaded.default ?? loaded;
    } catch (error) {
      throw new Error(`could not load ${pkg}: ${error.message}`, { cause: error });
    }
  }
  return plugins;
}
