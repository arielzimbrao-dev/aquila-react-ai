# React architecture — layout, components, hooks, state

Entry: [`../react.md`](../react.md). Version deltas: [`versions.md`](versions.md).

## Layout

- Feature folders: `src/features/<feature>/{components,hooks,api,types.ts,index.ts}` + tests next to the
  source. Cross-feature UI in `src/components/` (or the design-system package); app shell, providers and
  routing in `src/app/`. Follow the project's existing layout; don't reorganize inside a feature task.
- A feature imports from another only through its public `index.ts`; shared code moves down to
  `components/`/`lib/`, never sideways. Barrel files inside a feature hurt tree-shaking and cause cycles —
  import files directly within the feature.
- Next.js App Router: `app/` holds routes (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`); keep
  business UI in features and make route files thin.

## Components ([docs](https://react.dev/learn/your-first-component))

- Function components, `PascalCase`, one exported component per file, props as a typed object
  destructured in the signature with ES defaults. Spread remaining props onto the root element only for
  wrapper components.
- **Pure render** ([docs](https://react.dev/learn/keeping-components-pure)): no side effects, no mutation of
  props, state or module variables while rendering. StrictMode double-renders in dev to catch this — never
  "fix" it by disabling StrictMode.
- Composition over configuration: `children` and slot props before boolean-flag explosions
  (`isPrimary`, `isLarge`, `hasIcon`…). Over ~5 behavioral props → split or compose.
- Presentational vs container is a guideline, not a rule: keep data fetching in hooks so components stay
  easy to test.
- Never declare a component inside another (new type each render → remount and lost state).
- Error boundaries at route level and around risky widgets (class component or `react-error-boundary`
  if the project uses it).

## Hooks ([rules](https://react.dev/reference/rules/rules-of-hooks))

- Only at the top level of components and custom hooks; custom hooks start with `use` and are named
  after what they provide (`useCart`, not `useCartEffect`).
- Extract a custom hook when logic is reused or when a component mixes data + UI; a hook returns data and
  callbacks, never JSX.
- **You might not need an effect** ([docs](https://react.dev/learn/you-might-not-need-an-effect)):
  - derived values → compute in render (`useMemo` only if measured as expensive and no Compiler);
  - reset state on prop change → `key` on the component;
  - respond to a user action → the event handler;
  - fetch data → the data library or the framework loader.
- When an effect is right (subscriptions, DOM APIs, non-React widgets): complete dependency array,
  cleanup that undoes the setup, `AbortController` for fetches, idempotent under StrictMode's
  mount→unmount→mount. Use `useSyncExternalStore` for external stores (18+), `useEffectEvent` for
  non-reactive logic read inside an effect (19.2+).
- Never silence `react-hooks/exhaustive-deps`: restructure (move the function inside the effect, use an
  updater function, or `useEffectEvent`).
- `useRef` for values that don't affect render (timers, DOM nodes); reading/writing `ref.current` during
  render is a bug.

## State ([docs](https://react.dev/learn/managing-state))

- Choose the smallest home: local `useState` → lifted to the nearest common parent → context/store.
  `useReducer` when transitions are many or depend on the previous state.
- No redundant or duplicated state; no state mirrored from props (`useState(props.x)` only as an
  explicitly named initial value, e.g. `initialCount`).
- Updaters for state based on previous state: `setCount((c) => c + 1)`.
- Immutable updates (spread, `structuredClone`, or Immer if the project has it).
- Context ([docs](https://react.dev/learn/passing-data-deeply-with-context)): split by concern and by update
  frequency; memoize the value object when not on the Compiler; provide a typed `useX()` hook that throws
  outside its provider.
- Server cache (TanStack Query/SWR/RTK Query): query keys in one factory per feature, invalidate after
  mutations, no manual copies in client stores.
- URL state for anything shareable or that must survive reload (search params, route params).

## Performance

- Measure first: React DevTools Profiler, Performance Tracks (19.2+), Web Vitals (LCP, INP, CLS).
- React Compiler ([docs](https://react.dev/learn/react-compiler)) on → write plain code, no manual
  `memo`/`useMemo`/`useCallback`; off → memoize only where a profiler shows re-render cost or a hook
  dependency needs a stable identity.
- Code-split by route (`lazy` + `Suspense`, or framework defaults); virtualize long lists; images sized and
  lazy; avoid layout thrash in effects (`useLayoutEffect` only to measure before paint).
- Transitions (`startTransition`, `useDeferredValue`, 18+) to keep input responsive during heavy renders.

## Server Components (only if the framework uses them)

- Next.js App Router / RSC frameworks: components are Server Components by default; add `'use client'`
  only at the leaf that needs state, effects or browser APIs. Never import server-only code
  (DB, secrets) into a client module — use the `server-only` package if the project does.
- Server Functions (`'use server'`) are public endpoints: validate input and authorize inside each one.
- Props crossing the server→client boundary must be serializable.
