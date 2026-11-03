# React data, forms and routing

Entry: [`../react.md`](../react.md). Version deltas: [`versions.md`](versions.md).

## API client

- One client layer per backend (`src/api/` or `features/<x>/api/`): base URL from config, auth header or
  credentials, timeouts, error normalization (`ApiError` with status/code). Components and hooks call
  typed functions (`getOrder(id)`), never `fetch('/api/...')` inline.
- Types come from the contract: generated from OpenAPI/GraphQL (`openapi-typescript`, `orval`,
  GraphQL Codegen) when the project does, otherwise hand-written next to the client. Never invent fields
  the backend doesn't return — confirm in the contract or the backend code.
- Untrusted or versioned responses: parse at the boundary with the project's schema library (Zod,
  Valibot) and fail loudly instead of rendering `undefined`.
- Cancel in-flight requests on unmount/param change (`AbortController`; data libraries do it via `signal`).

## Server state ([TanStack Query](https://tanstack.com/query/latest), SWR, RTK Query)

- Use the library the project already has; one query-key factory per feature
  (`orderKeys.detail(id)`), stable and serializable keys.
- Mutations: invalidate or update the affected queries; optimistic updates roll back on error
  (`useOptimistic` on 19+ with Actions, or the library's `onMutate`).
- Configure `staleTime`/retry centrally; don't retry 4xx.
- Prefetch on hover/route loader for known navigation; no request waterfalls (parallel queries,
  loaders, or `Promise.all`).
- Framework data APIs win when present: React Router loaders/actions, Next.js Server Components +
  `fetch` caching, Remix loaders.

## UI states

- Every async view renders **loading**, **error** (with retry when it makes sense), **empty** and
  **success**. Suspense + error boundaries or explicit `isPending`/`isError` — follow the project.
- Skeletons over spinners for layout-heavy views; never a blank screen.
- Mutations: disable or debounce the trigger while pending (`useFormStatus`/`isPending`), show success
  and failure feedback, keep user input on failure.
- Errors shown to users are friendly and actionable; technical details go to the error reporter.

## Forms

- The project's approach: React Hook Form / TanStack Form / Formik + schema resolver, or React 19 Actions
  (`<form action={fn}>`, `useActionState`, `useFormStatus`). Don't mix approaches in one form.
- One schema per form, shared with the API layer when possible; types inferred from it.
- Controlled inputs only when needed (live formatting, dependent fields); uncontrolled + library
  registration otherwise.
- Every input has a `<label>` (or `aria-label`), errors linked with `aria-describedby` and announced;
  focus moves to the first invalid field on submit.
- Map server validation errors back to fields; client validation never replaces server validation.

## Routing

- React Router: routes declared in one place (`createBrowserRouter` / framework mode routes file);
  v7 merges Remix — follow the mode the project uses. Next.js: file-based (`app/` or `pages/`).
- Route-level code splitting (`lazy`), route-level `errorElement`/`error.tsx` and not-found routes.
- Auth guards as layout routes/loaders/middleware, not scattered `useEffect` redirects; the server still
  enforces authorization.
- Links are `<Link>`/`<a href>`, never `onClick={() => navigate()}` on a `div` — keeps keyboard, middle
  click and prefetch.
- Read/write URL search params for filters, sort, pagination and tabs; validate them (schema) because
  users can edit them.
- Scroll restoration and document title per route (`<title>` in component on 19+, or the framework's
  metadata API).

## Real-time and background

- WebSocket/SSE subscriptions in one hook or the data library's subscription API, with cleanup and
  reconnect/backoff; merge pushed data into the query cache instead of parallel state.
- Polling via the data library (`refetchInterval`), paused when the tab is hidden.

## Mock layer

- MSW handlers (`src/mocks/` or `test/mocks/`) mirror the API contract and are shared by tests,
  Storybook and local dev when the project does. Update them in the same task as an API change.
