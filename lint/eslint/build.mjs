// Builds the ESLint flat config from the catalog (lint/rules.json) for a level. Pure: it receives the
// already-loaded plugins, so it is testable without installing them. Rules whose plugin is not installed
// in the project are skipped and reported in `missing`.
import { globToRegex } from '../../bin/glob.mjs';
import { LINT_LEVELS } from '../../bin/lint.mjs';
import { PLUGIN_OF, pluginName } from './plugins.mjs';

const CODE = '{ts,tsx,mts,cts,js,jsx,mjs,cjs}';
const TS = '{ts,tsx,mts,cts}';

/** Local plugin: rules that ESLint core lacks with the semantics aquila-react-ai needs. */
export const aquilaPlugin = {
  rules: {
    // `max-params` without constructors: class constructors (DI, error classes) are not counted. Components
    // take a single props object, so they never hit it.
    'max-params': {
      meta: { type: 'suggestion', schema: [{ type: 'integer', minimum: 0 }] },
      create(context) {
        const max = context.options[0] ?? 5;
        const check = (node) => {
          const ctor =
            node.parent?.type === 'MethodDefinition' && node.parent.kind === 'constructor';
          if (!ctor && node.params.length > max) {
            context.report({
              node,
              message: `Function with ${node.params.length} parameters (max ${max}): group them into an object.`,
            });
          }
        };
        return {
          FunctionDeclaration: check,
          FunctionExpression: check,
          ArrowFunctionExpression: check,
        };
      },
    },
    // `process.env` / `import.meta.env` only in configuration paths (settings.aquila.configPaths).
    'config-only-env': {
      meta: { type: 'problem', schema: [] },
      create(context) {
        const paths = context.settings?.aquila?.configPaths ?? [];
        const slash = (x) => x.split('\\').join('/');
        const file = slash(context.filename ?? context.getFilename());
        const root = slash(context.settings?.aquila?.root ?? '');
        const rel = root && file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file;
        if (paths.some((g) => globToRegex(g).test(rel))) return {};
        const report = (node) =>
          context.report({
            node,
            message:
              'process.env / import.meta.env only in configuration modules (AQ-CFG-01): import the typed config.',
          });
        return {
          "MemberExpression[object.name='process'][property.name='env']": report,
          "MemberExpression[object.type='MetaProperty'][property.name='env']": report,
        };
      },
    },
  },
};

/**
 * @param {{ rules: object[] }} catalog
 * @param {{ level: string, srcDirs: string[], testGlobs?: string[], configPaths?: string[], root?: string, aliases?: Record<string, string>, plugins: Record<string, object|null> }} opts
 * @returns {{ config: object[], missing: string[], coverage: object[] }}
 */
export function buildEslintConfig(catalog, opts) {
  const levels = LINT_LEVELS[opts.level] ?? LINT_LEVELS.standard;
  // TypeScript project (typescript-eslint installed) → .ts only: config .js files are outside the tsconfig
  // and the typed parser cannot read them.
  const code = opts.plugins['typescript-eslint'] ? TS : CODE;
  const src = opts.srcDirs.map((d) => `${d}/**/*.${code}`);
  const test = opts.testGlobs ?? [
    ...(opts.testDirs ?? ['test']).map((d) => `${d}/**/*.${code}`),
    `**/*.{spec,test,e2e-spec}.${code}`,
  ];
  const scopes = { src, test, all: [...src, ...test] };
  const rules = { src: {}, test: {}, all: {} };
  const scoped = [];
  const presets = [];
  const missing = new Set();
  const coverage = [];
  const plugins = { ...opts.plugins, aquila: aquilaPlugin };

  for (const entry of catalog.rules.filter((r) => levels.includes(r.level))) {
    let configured = 0;
    const pending = new Set();
    for (const e of entry.enforce?.eslint ?? []) {
      if (e.preset) {
        const [name, preset] = e.preset.split('/');
        const plugin = plugins[name];
        if (!plugin?.configs?.[preset]) {
          missing.add(name);
          pending.add(name);
          continue;
        }
        configured++;
        presets.push({ ...plugin.configs[preset], files: scopes.all });
        for (const off of e.off ?? []) rules.all[off] = 'off';
        for (const off of e.offInTests ?? []) rules.test[off] = 'off';
        continue;
      }
      const name = pluginName(e.rule);
      if (name && !plugins[name]) {
        missing.add(name);
        pending.add(name);
        continue;
      }
      configured++;
      let options = e.options ?? [];
      if (e.rule === 'jest/valid-title' && opts.ticketPattern) {
        options = [
          { ...options[0], mustNotMatch: [opts.ticketPattern, 'No ticket ids in test titles'] },
        ];
      }
      const value = ['error', ...options];
      if (e.ignores)
        scoped.push({ files: scopes[e.files ?? 'all'], ignores: e.ignores, rule: e.rule, value });
      else rules[e.files ?? 'all'][e.rule] = value;
    }
    coverage.push({
      id: entry.id,
      configured,
      total: entry.enforce?.eslint?.length ?? 0,
      pending: [...pending],
    });
  }

  // ESLint rejects the same prefix with different objects: presets win (they are the same instance).
  const fromPresets = Object.assign({}, ...presets.map((preset) => preset.plugins ?? {}));
  const usedPlugins = {};
  const aliased = new Set();
  for (const [short, name] of Object.entries(PLUGIN_OF)) {
    if (!plugins[name]) continue;
    usedPlugins[short] =
      fromPresets[short] ?? (name === 'typescript-eslint' ? plugins[name].plugin : plugins[name]);
  }
  // Aliases (`lint.options.aliases`, e.g. { "local/max-params": "aquila/max-params" }): the project already
  // has the equivalent rule under another name, with `eslint-disable` for it. The aquila-react-ai rule runs under
  // the project's name, so those disables cover it and avoid "Definition for rule … was not found".
  for (const [from, to] of Object.entries(opts.aliases ?? {})) {
    const [fromPlugin, fromRule] = [from.slice(0, from.lastIndexOf('/')), from.split('/').pop()];
    const impl = usedPlugins[to.slice(0, to.lastIndexOf('/'))]?.rules?.[to.split('/').pop()];
    if (!fromPlugin || !impl || (usedPlugins[fromPlugin] && !aliased.has(fromPlugin))) continue;
    aliased.add(fromPlugin);
    usedPlugins[fromPlugin] ??= { rules: {} };
    usedPlugins[fromPlugin].rules[fromRule] = impl;
    for (const r of Object.values(rules)) {
      if (!(to in r)) continue;
      r[from] = r[to];
      delete r[to];
    }
    for (const s of scoped) if (s.rule === to) s.rule = from;
  }
  const settings = { aquila: { configPaths: opts.configPaths ?? [], root: opts.root } };
  const block = (files, r) => ({ files, plugins: usedPlugins, settings, rules: r });
  const ts = plugins['typescript-eslint'];
  // JSX is parsed in .jsx/.tsx either way; typescript-eslint infers it from the extension.
  const language = [
    ts
      ? {
          files: scopes.all,
          languageOptions: {
            parser: ts.parser,
            parserOptions: { projectService: true, tsconfigRootDir: opts.root },
          },
        }
      : { files: scopes.all, languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } } },
  ];

  const config = [
    // Layer on top of the project's lint: directives for rules only the project has are not "unused".
    { linterOptions: { reportUnusedDisableDirectives: 'off' } },
    {
      ignores: [
        'dist/**',
        'build/**',
        'coverage/**',
        'node_modules/**',
        '.claude/**',
        '.agents/**',
      ],
    },
    ...language,
    ...presets,
    block(scopes.all, rules.all),
    block(scopes.src, rules.src),
    block(test, rules.test),
    ...scoped.map((s) => ({ ...block(s.files, { [s.rule]: s.value }), ignores: s.ignores })),
  ];
  // Framework components: the catalog applies to .ts/.js; .vue/.svelte get the recommended preset
  // of the framework's own plugin (which brings the right parser).
  for (const name of ['vue', 'svelte']) {
    const preset =
      plugins[name]?.configs?.['flat/recommended'] ?? plugins[name]?.configs?.recommended;
    if (preset) config.push(...[preset].flat());
  }
  if (plugins.prettier) config.push(plugins.prettier);
  return { config, missing: [...missing], coverage };
}
