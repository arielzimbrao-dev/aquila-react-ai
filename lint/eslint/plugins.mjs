import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PLUGIN_OF = {
  '@typescript-eslint': 'typescript-eslint',
  sonarjs: 'sonarjs',
  unicorn: 'unicorn',
  jest: 'jest',
  react: 'react',
  'react-hooks': 'react-hooks',
  'jsx-a11y': 'jsx-a11y',
  aquila: 'aquila',
};

const PACKAGES = {
  'typescript-eslint': 'typescript-eslint',
  sonarjs: 'eslint-plugin-sonarjs',
  unicorn: 'eslint-plugin-unicorn',
  jest: 'eslint-plugin-jest',
  react: 'eslint-plugin-react',
  'react-hooks': 'eslint-plugin-react-hooks',
  'jsx-a11y': 'eslint-plugin-jsx-a11y',
  vue: 'eslint-plugin-vue',
  svelte: 'eslint-plugin-svelte',
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
