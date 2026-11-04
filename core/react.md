# React conventions

How agents write React code under aquila-react-ai. Project rules win (`docs/ai/`, `.github/instructions/`,
golden files — [`golden-files.md`](golden-files.md)); this file is the default when the project is silent.
Open a reference file only for the area the task touches.

**The project's stack wins.** Libraries named here (TanStack Query, Zod, MSW, Playwright…) are the default
**only when the project has nothing for that concern yet**. If it already has its own data hook, `vi.mock`/
`jest.mock` strategy, WebdriverIO/Cypress, another schema library: follow that (its golden file), never
migrate it as a side effect — a stack change is its own task (ADR + plan).

## 1. Version and framework first

1. Read the installed major: `react` in `package.json` (resolve ranges against the lockfile or
   `node_modules/react/package.json`). The generated `AGENTS.md` states it (`React <major>`, refreshed by
   `npx aquila-react-ai sync`); the installed package still wins on conflict ([`precedence.md`](precedence.md)).
2. Identify the host: Vite SPA, Next.js (App Router vs Pages Router), React Router (library vs framework
   mode), Remix, Expo/React Native… Framework conventions (routing, data loading, server code) beat the
   generic rules here; check the framework's installed major too.
3. Apply the rules of that major from [`react/versions.md`](react/versions.md). Never use an API newer than
   the project's version; never "upgrade while passing by" — a major bump is its own task (ADR + plan).
4. Version-specific syntax to check every time: `createRoot` (18+), `ref` as a prop / `forwardRef`
   (19+), Actions and `useActionState`/`useOptimistic`/`use` (19+), `<Activity>`/`useEffectEvent` (19.2+),
   `<ViewTransition>`/Fragment refs/`browser()` (19.3+),
   React Compiler on or off (changes whether manual memoization is expected).
5. Docs: <https://react.dev/> is the current major; 18 lives at <https://18.react.dev/>.

## 2. Checklist (default rules)

**Layout & components** — [`react/architecture.md`](react/architecture.md)
- Group by feature (`features/<name>/` with components, hooks, api, tests); shared UI in `components/` or
  the design system. Follow the project's existing layout and file naming (`PascalCase.tsx` or kebab-case).
- Function components only; one exported component per file; props typed with a `type`/`interface`; no
  `defaultProps` on function components (ES default parameters).
- Components are pure: same props/state → same JSX; no side effects, no mutation of props/state during
  render. Side effects live in event handlers first, `useEffect` only to sync with an external system.
- Reuse the design system/component library before writing a new component; never fork it inline.

**State**
- Derive, don't store: anything computable from props/state is computed in render, not mirrored with an
  effect. Keep state minimal, colocated, lifted only as far as needed.
- Server data is cache, not state: use the project's data layer (its own hooks, TanStack Query, SWR, RTK
  Query, router loaders, RSC — whatever it has); if it has none yet, TanStack Query. Never copy fetched data
  into `useState` + `useEffect` by hand in a new place.
- Global client state (Context, Zustand, Redux Toolkit…) only for truly app-wide UI state; split contexts
  so a change doesn't re-render the whole tree. URL state (filters, tabs, pagination) lives in the URL.
- Immutable updates; `key` on list items is a stable id, never the index.

**Data, forms, routing** — [`react/data-routing.md`](react/data-routing.md)
- One typed API client layer (`api/`, generated from OpenAPI if the project does); components don't call
  `fetch` with string URLs. Validate untrusted responses at the boundary with the project's schema library
  when it has one.
- Every async UI has loading, error and empty states; mutations prevent double submit and show feedback.
- Forms: the project's form library (React Hook Form, TanStack Form, React 19 Actions) + schema validation;
  server errors mapped back to fields. Client validation is UX, never security.
- Routes lazy-loaded at the route level; errors caught by route-level error boundaries.

**Config, security, a11y, performance** — [`react/security-config.md`](react/security-config.md)
- Env read only in one typed config module (`import.meta.env.VITE_*`, `process.env.NEXT_PUBLIC_*`);
  anything bundled is public — no secrets in the client ([`quality.md`](quality.md) `configPaths`).
- No `dangerouslySetInnerHTML` without DOMPurify; no `javascript:` URLs from user input; tokens not in
  `localStorage` when the project can use httpOnly cookies.
- Semantic HTML first (`button`, `a`, `label`, landmarks); keyboard-operable; visible focus; ARIA only to
  fill gaps. Images have `alt`.
- Measure before optimizing; with React Compiler on, don't add `useMemo`/`useCallback`/`memo` by hand.
- No `console.*` in `src`: the project's logger/error reporter.

**Testing** — [`react/testing.md`](react/testing.md)
- Unit/component: the project's runner (Vitest or Jest) + React Testing Library; query by role/label
  like a user, `userEvent` for interactions; test behavior, not implementation.
- Mock the network the way the project already does (`vi.mock`/`jest.mock` of its API module, MSW…); with no
  convention yet, MSW at the boundary rather than mocking the component's hooks.
- E2E with the project's tool (WebdriverIO, Cypress, Playwright…; Playwright if it has none) for critical
  user flows. Tests come first (failing) per [`workflow.md`](workflow.md).

## 3. Review red flags

- API newer than the project's React/framework major; `forwardRef` added on 19+; `ReactDOM.render` on 18+.
- `useEffect` that derives state, fetches without cleanup/cancellation, or has a silenced dependency array.
- Fetched data copied into local state; prop drilling replaced by a giant context; index as `key`.
- Component defined inside another component; hooks called conditionally.
- Secret/API key in client code or `VITE_`/`NEXT_PUBLIC_` env; `dangerouslySetInnerHTML` on unsanitized input.
- Clickable `div` without role/keyboard; missing label/alt; missing loading/error/empty state.
- Tests using `container.querySelector`, snapshot-only tests, or `getByTestId` where a role query works.
