// Builds the ESLint flat config from the catalog (lint/rules.json) for a level. Pure: it receives the
// already-loaded plugins, so it is testable without installing them. Rules whose plugin is not installed
// in the project are skipped and reported in `missing`.
import { globToRegex } from '../../bin/glob.mjs';
import { LINT_LEVELS } from '../../bin/lint.mjs';
import { PROFILE } from '../../bin/profile.mjs';
import { PLUGIN_OF, pluginName } from './plugins.mjs';

const CODE = '{ts,tsx,mts,cts,js,jsx,mjs,cjs}';
const TS = '{ts,tsx,mts,cts}';

/** Local plugin: rules that ESLint core lacks with the semantics aquila-react-ai needs. */
export const aquilaPlugin = {
  rules: {
    // `max-params` without constructors: in DI frameworks (NestJS) constructor parameters are the injection.
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
    // Environment access (`process.env`, and `import.meta.env` on Vite stacks) only in configuration paths
    // (settings.aquila.configPaths). Which accesses count is the stack's (profile).
    'config-only-env': {
      meta: { type: 'problem', schema: [] },
      create(context) {
        const paths = context.settings?.aquila?.configPaths ?? [];
        const slash = (x) => x.split('\\').join('/');
        const file = slash(context.filename ?? context.getFilename());
        const root = slash(context.settings?.aquila?.root ?? '');
        const rel = root && file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file;
        if (paths.some((g) => globToRegex(g).test(rel))) return {};
        const access = PROFILE.lint.envAccess;
        const report = (node) =>
          context.report({
            node,
            message: `${access.join(' / ')} only in configuration modules (AQ-CFG-01): ${PROFILE.lint.envHint}.`,
          });
        return {
          "MemberExpression[object.name='process'][property.name='env']": report,
          ...(access.includes('import.meta.env')
            ? { "MemberExpression[object.type='MetaProperty'][property.name='env']": report }
            : {}),
        };
      },
    },
  },
};

/**
 * A catalog rule with `"fix": false` reports its autofix as a suggestion (e.g. `unicorn/prefer-at`: `.at(-1)`
 * is `T | undefined`, so the fix breaks the typecheck without noUncheckedIndexedAccess). `skip` (a preset's
 * `skipWhenMatches`): a report is dropped when the source of the reported node's parent matches the regex
 * (e.g. the whole `it(…)` call for sonarjs/assertions-in-tests).
 */
function wrapRule(base, { fix = true, skip }) {
  const re = skip ? new RegExp(skip) : null;
  return {
    ...base,
    meta: { ...base.meta, ...(fix ? {} : { hasSuggestions: true }) },
    create(context) {
      const report = (d) => {
        const node = d.node?.parent ?? d.node;
        if (re && node && re.test((context.sourceCode ?? context.getSourceCode()).getText(node))) return;
        if (!fix && d.fix)
          d = { ...d, fix: undefined, suggest: [...(d.suggest ?? []), { desc: 'Apply the change (check the types it returns)', fix: d.fix }] };
        context.report(d);
      };
      return base.create(Object.create(context, { report: { value: report } }));
    },
  };
}

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
  const testFiles = `**/*.{spec,test,e2e-spec}.${code}`;
  // Tests next to the code (testDirs = srcDirs): a test folder that is also a source folder adds nothing to the
  // test scope (its tests match testFiles), and production-only rules ignore the test files.
  const test = (
    opts.testGlobs ?? [...(opts.testDirs ?? ['test']).map((d) => `${d}/**/*.${code}`), testFiles]
  ).filter((g) => !src.includes(g));
  if (!test.length) test.push(testFiles);
  const prodIgnores = [testFiles, ...test.filter((g) => g !== testFiles)];
  const scopes = { src, test, all: [...src, ...test] };
  const rules = { src: {}, test: {}, all: {} };
  const scoped = [];
  const presets = [];
  const missing = new Set();
  const wraps = {};
  const unknown = new Set();
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
        for (const [rule, skip] of Object.entries(e.skipWhenMatches ?? {})) wraps[rule] = { ...wraps[rule], skip };
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
      // A rule the installed plugin version does not define (renamed/removed): skipped, not a crash.
      const impl = name === 'typescript-eslint' ? plugins[name].plugin : plugins[name];
      const known = impl?.rules && Object.keys(impl.rules).length ? impl.rules : null;
      if (name && name !== 'aquila' && known && !known[e.rule.split('/').pop()]) {
        pending.add(e.rule);
        unknown.add(e.rule);
        continue;
      }
      configured++;
      if (e.fix === false) wraps[e.rule] = { ...wraps[e.rule], fix: false };
      let options = e.options ?? [];
      if (e.rule === 'jest/valid-title' && opts.ticketPattern) {
        options = [
          { ...options[0], mustNotMatch: [opts.ticketPattern, 'No ticket ids in test titles'] },
        ];
      }
      const value = ['error', ...options];
      // DI stacks (NestJS, emitDecoratorMetadata): a constructor parameter's type is a runtime value. Whatever
      // tsconfig the linter resolves, `--fix` must not turn those imports into `import type` (DI breaks only
      // at runtime): the rule skips files with decorators, as typescript-eslint does when it sees the flag.
      if (e.rule === '@typescript-eslint/consistent-type-imports' && PROFILE.lint.decoratorMetadata) {
        const base = plugins['typescript-eslint']?.plugin?.rules?.['consistent-type-imports'];
        if (base) {
          aquilaPlugin.rules['consistent-type-imports'] = {
            meta: base.meta,
            create: (context) =>
              /^\s*@[A-Za-z_$][\w$.]*\s*\(/m.test((context.sourceCode ?? context.getSourceCode()).text)
                ? {}
                : base.create(context),
          };
          rules[e.files ?? 'all']['aquila/consistent-type-imports'] = value;
          continue;
        }
      }
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
  // Wrapped rules run from a copy of their plugin; presets get the same copy (ESLint rejects two objects).
  for (const [id, how] of Object.entries(wraps)) {
    const prefix = id.slice(0, id.lastIndexOf('/'));
    const name = id.split('/').pop();
    const base = usedPlugins[prefix]?.rules?.[name];
    if (!base) continue;
    usedPlugins[prefix] = { ...usedPlugins[prefix], rules: { ...usedPlugins[prefix].rules, [name]: wrapRule(base, how) } };
    for (const p of presets.filter((x) => x.plugins?.[prefix])) p.plugins = { ...p.plugins, [prefix]: usedPlugins[prefix] };
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
  const block = (files, r, ignores) => ({ files, ...(ignores ? { ignores } : {}), plugins: usedPlugins, settings, rules: r });
  const ts = plugins['typescript-eslint'];
  // NestJS: with emitDecoratorMetadata the constructor parameter types are runtime values (DI).
  // typescript-eslint then keeps consistent-type-imports from turning those imports into `import type`.
  const decorators = PROFILE.lint.decoratorMetadata
    ? { emitDecoratorMetadata: true, experimentalDecorators: true }
    : {};
  const language = ts
    ? [
        {
          files: scopes.all,
          languageOptions: {
            parser: ts.parser,
            parserOptions: { projectService: true, tsconfigRootDir: opts.root, ...decorators },
          },
        },
      ]
    : PROFILE.lint.jsx
      ? [{ files: scopes.all, languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } } }]
      : [];

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
    block(scopes.src, rules.src, prodIgnores),
    block(test, rules.test),
    ...scoped.map((s) =>
      block(s.files, { [s.rule]: s.value }, [...s.ignores, ...(s.files === scopes.src ? prodIgnores : [])]),
    ),
  ];
  if (plugins.prettier) config.push(plugins.prettier);
  // Project overrides (lint.overrides) win over the level, per rule, everywhere aquila lints.
  const overrides = Object.entries(opts.overrides ?? {});
  if (overrides.length)
    config.push({
      files: scopes.all,
      plugins: usedPlugins,
      rules: Object.fromEntries(overrides.map(([rule, value]) => [rule, value])),
    });
  return { config, missing: [...missing], unknown: [...unknown], coverage };
}
