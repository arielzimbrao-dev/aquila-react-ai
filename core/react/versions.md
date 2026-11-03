# React versions — what changes when writing code

Detect the major first ([`../react.md`](../react.md) §1). Only the deltas that change how code is
written are listed; upgrades themselves follow the official guide for the target version. Framework
majors (Next.js, React Router, Remix) have their own deltas — check their installed version and docs.

## 16.8 → 17 ([blog](https://legacy.reactjs.org/blog/2020/10/20/react-v17.html))

- Hooks available since 16.8 — function components + hooks for all new code.
- New JSX transform (`react/jsx-runtime`): no `import React` needed just for JSX.
- Events delegated to the root container, not `document`; no event pooling (`e.persist()` is a no-op).
- Effect cleanups run asynchronously after the screen updates.

## 17 → 18 ([guide](https://react.dev/blog/2022/03/08/react-18-upgrade-guide))

- **`createRoot(el).render(<App />)`** (`react-dom/client`); `ReactDOM.render` is legacy mode.
  `hydrateRoot` for SSR.
- **Automatic batching** of updates inside promises, timeouts and native handlers (`flushSync` to opt out).
- Concurrent features: `useTransition`/`startTransition`, `useDeferredValue`, Suspense for data in
  frameworks; new hooks `useId`, `useSyncExternalStore`, `useInsertionEffect` (CSS-in-JS libs only).
- **StrictMode in dev mounts, unmounts and remounts** every component: effects must clean up and be
  idempotent.
- Testing: `@testing-library/react` 13+ (`renderHook` from 13.1); `globalThis.IS_REACT_ACT_ENVIRONMENT`.
- TypeScript (`@types/react` 18): `children` is no longer implicit in `React.FC` — declare it.

## 18 → 19 ([guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide), [release](https://react.dev/blog/2024/12/05/react-19))

- **Actions:** async functions in transitions; `<form action={fn}>`, `useActionState` (replaces canary
  `useFormState`), `useFormStatus` (`react-dom`), `useOptimistic`.
- **`use(promise | context)`**: read a resource during render (can be conditional, unlike hooks); the
  promise must be cached (framework/data library), not created in render.
- **`ref` is a regular prop** for function components — no new `forwardRef`. Ref callbacks may return a
  cleanup function (so don't implicitly return from them).
- `<Context value>` works as a provider (`<Context.Provider>` still works).
- Document metadata (`<title>`, `<meta>`, `<link>`) rendered in components is hoisted to `<head>`;
  stylesheet `precedence`; `preload`/`preinit` resource APIs.
- Server Components and Server Functions (`'use server'`) stable for frameworks that support them.
- `useDeferredValue(value, initialValue)`.
- **Removed:** `propTypes` checks and `defaultProps` on function components (use TS + ES defaults),
  legacy context (`contextTypes`), string refs, `createFactory`, `ReactDOM.render`/`hydrate`/
  `unmountComponentAtNode`/`findDOMNode`, `react-dom/test-utils` (`act` → from `react`),
  `react-test-renderer/shallow`, UMD builds. New JSX transform required.
- Errors in render are no longer re-thrown: report via `createRoot` `onUncaughtError`/`onCaughtError`.
- TypeScript (`@types/react` 19): `useRef` requires an argument; `ref.current` is mutable; global `JSX`
  namespace → `React.JSX`; `ReactElement['props']` defaults to `unknown`.
- Codemods: `npx codemod@latest react/19/migration-recipe` and `types-react-codemod`.

## 19.1 ([blog](https://react.dev/blog/2025/03/28/react-19-1))

- Owner stacks in dev (`captureOwnerStack`) for better error/warning traces.
- Suspense fixes and improvements across client and server rendering.

## 19.2 ([release](https://react.dev/blog/2025/10/01/react-19-2))

- `<Activity mode="visible" | "hidden">`: keep UI mounted but hidden (state preserved, effects paused) —
  prefer it over conditional rendering for tabs/back navigation when state must survive.
- **`useEffectEvent`**: non-reactive logic read inside effects without adding it to the dependency array
  (the lint plugin knows it). Not a way to silence real dependencies.
- `cacheSignal` (Server Components); Partial Pre-rendering APIs (`prerender`/`resume`) for frameworks.
- Performance Tracks in Chrome DevTools; batched Suspense boundary reveals during SSR.
- `useId` prefix changed (`_r_`) — don't depend on its format.

## 19.3 ([release](https://react.dev/blog/2026/09/09/react-19-3))

- **`<ViewTransition>`** stable: animates elements entering, exiting, moving or resizing through the
  browser's View Transition API, triggered by Transitions/Suspense/`useDeferredValue` updates
  (`startTransition`, `addTransitionType`). DOM only; prefer it over hand-rolled enter/exit animation
  libraries when the project targets 19.3+.
- **Fragment refs** stable: `<Fragment ref={r}>` gives a `FragmentInstance` with DOM methods over the
  Fragment's children (focus, observers, event listeners) — no wrapper `div` just to get a ref.
- **`browser()`** for server-rendered apps: content that depends on browser-only data (`localStorage`, the
  user's time zone) without hydration mismatches or `useEffect` + `isClient` flags.
- **Trusted Types:** `TrustedHTML`/`TrustedScript`/`TrustedScriptURL` values pass through without being
  coerced to strings, so a Trusted Types CSP policy works with React DOM.
- Server Components can render a Context from a `'use client'` module directly.

## React Compiler ([docs](https://react.dev/learn/react-compiler))

- Stable 1.0 (Oct 2025); works on React 17+ (17/18 need `react-compiler-runtime`). Enabled via the
  Babel plugin / framework option (Next.js `reactCompiler`, Vite plugin).
- On: write idiomatic code, no new manual `useMemo`/`useCallback`/`memo`; keep existing ones unless a
  task removes them. Rules of React violations make the compiler skip a component — fix the violation.
- `eslint-plugin-react-hooks` 6+ ships the compiler-aware rules in its recommended flat config.

## Do / don't by project version

| Project on | Do | Don't |
|---|---|---|
| 17 | Hooks; new JSX transform; `ReactDOM.render` | `createRoot`, `useId`, `useTransition`, `useSyncExternalStore` |
| 18 | `createRoot`; transitions; `useId`; effects idempotent under StrictMode; `forwardRef` for ref forwarding | `use`, Actions, `useActionState`, `useOptimistic`, `ref` as prop, `<Context value>`, `<title>` in components |
| 19 | Everything from 18; `ref` as prop; Actions/`useActionState`/`useFormStatus`; `act` from `react`; TS `useRef(initial)` | New `forwardRef`; `defaultProps` on function components; `propTypes`; `react-dom/test-utils`; string refs |
| 19.2 | Everything from 19; `useEffectEvent`; `<Activity>` | Using `useEffectEvent` to dodge real dependencies; `<ViewTransition>`, Fragment refs, `browser()` |
| 19.3+ | Everything from 19.2; `<ViewTransition>`; Fragment refs instead of wrapper elements; `browser()` for browser-only SSR content | Wrapper `div`s only to hold a ref; `isClient` effect flags where `browser()` fits |

Latest at the time of writing: 19.3.1 (npm). Unconfirmed in official sources: anything about React 20.
Check `node_modules/react/package.json` and <https://react.dev/versions>.
