# React config, security, accessibility and operations

Entry: [`../react.md`](../react.md). Version deltas: [`versions.md`](versions.md).

## Configuration

- One typed module reads and validates env at startup (e.g. `src/config/env.ts` with Zod) and exports a
  frozen object; the rest imports it. Raw `import.meta.env` / `process.env` only there
  ([`../quality.md`](../quality.md) `configPaths`).
- Vite exposes only `VITE_*` (`import.meta.env`); Next.js only `NEXT_PUBLIC_*` to the browser; CRA
  `REACT_APP_*`. **Everything exposed is public**: it ships in the bundle.
- Build-time vs runtime config: when the same build is deployed to many environments, load a runtime
  `config.json`/`window.__CONFIG__` instead of baking env in — follow the project.
- `.env` files with real values are gitignored; `.env.example` lists keys without values.
- Feature flags read through one hook/client (`useFlag('x')`), with a safe default when the provider fails.

## Secrets

- No secrets in the client, ever: API keys for paid/privileged services go behind a backend/BFF or a
  server function. Publishable keys (Stripe publishable, Firebase web config, Sentry DSN) are fine.
- Never log tokens, passwords, full form payloads or PII to the console or the error reporter; scrub in
  the reporter's `beforeSend`.

## XSS and injection

- React escapes text by default; the holes are `dangerouslySetInnerHTML`, `href`/`src` from user input and
  third-party HTML. Sanitize HTML with DOMPurify; allow only `http(s):`/`mailto:` URLs from user data
  (React 19 blocks `javascript:` URLs in dev warnings — don't rely on it).
- No `eval`, `new Function`, or string `setTimeout`. Markdown via a renderer that sanitizes.
- `target="_blank"` links: modern browsers imply `noopener`; add `rel="noopener noreferrer"` if the project
  supports old browsers.
- A Content-Security-Policy (set by the server/CDN) is the backstop; avoid inline scripts that force
  `unsafe-inline`. On 19.3+ a Trusted Types policy (`require-trusted-types-for 'script'`) works with
  React DOM — use it when the project enforces Trusted Types.

## Authentication & authorization

- Prefer httpOnly, `Secure`, `SameSite` cookies set by the backend over tokens in `localStorage`
  (readable by any XSS). If tokens must live in JS, keep them in memory and refresh silently.
- OAuth/OIDC in SPAs: Authorization Code + PKCE through the provider's SDK; never the implicit flow.
- Client-side guards and hidden buttons are UX only — the API must authorize every request. Never trust
  role flags read from `localStorage`.
- Logout clears the server session, the query cache and persisted client stores.
- CSRF: cookie-authenticated mutations need the backend's CSRF protection (SameSite + token header).

## Accessibility ([WCAG 2.2](https://www.w3.org/TR/WCAG22/), [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/))

- Target WCAG 2.2 AA unless the project states otherwise.
- Semantic elements first: `<button>` for actions, `<a href>` for navigation, `<label>` for inputs,
  headings in order, landmarks (`main`, `nav`). A clickable `div` needs role, `tabIndex` and key handlers
  — use a `button` instead.
- Keyboard: everything operable with Tab/Enter/Space/Escape; visible focus; focus trapped in modals and
  restored on close; skip link on app shells.
- Dynamic updates announced (`aria-live` for toasts/async results); form errors linked with
  `aria-describedby`.
- Color contrast ≥ 4.5:1 for text; never color alone to convey state; respect `prefers-reduced-motion`.
- Prefer the design system's accessible primitives (Radix, React Aria, Headless UI…) to hand-rolled
  menus, dialogs and comboboxes.
- Check with `jsx-a11y` lint, Testing Library role queries and an axe run (`vitest-axe`/`jest-axe`,
  `@axe-core/playwright`) when the project has them.

## Errors and observability

- Root error boundary with a fallback UI + reporter (Sentry, Datadog RUM…); route-level boundaries so one
  broken view doesn't blank the app. React 19: `createRoot(el, { onUncaughtError, onCaughtError })`.
- Report unhandled promise rejections; attach release/version and route, not PII.
- Web Vitals (LCP, INP, CLS) reported to the project's analytics when it tracks them.

## Dependencies and build

- New dependency = justified in the plan (bundle size, maintenance, license); prefer the platform and
  what is installed.
- Source maps uploaded to the reporter, not served publicly unless the project decides so.
- Watch bundle budgets if the project has them (`size-limit`, bundle analyzer); lazy-load heavy libs.

## i18n (if the project has it)

- All user-facing strings through the i18n library (`react-intl`, `i18next`, `next-intl`); no
  concatenated sentences; dates/numbers via `Intl`. New keys added to every locale file in the same task.
