# React testing — unit, component, integration, e2e

Entry: [`../react.md`](../react.md). Method: tests first, failing, per [`../workflow.md`](../workflow.md);
copy the golden component/e2e test of the project ([`../golden-files.md`](../golden-files.md)).
Guides: <https://testing-library.com/docs/react-testing-library/intro/> ·
<https://testing-library.com/docs/guiding-principles>.

## Runner

- Use the project's runner and config: Vitest (Vite projects) or Jest (CRA, older Next.js), with a DOM
  environment (`jsdom` or `happy-dom`) and `@testing-library/jest-dom` matchers. Don't switch runners
  inside a feature task.
- Vitest browser mode / Playwright component tests only if the project already uses them.
- Files: `*.test.tsx`/`*.spec.tsx` next to the source; e2e in `e2e/` or `tests/` (Playwright default).
- React 18+: `@testing-library/react` ≥ 13; React 19: `act` imported from `react`, not
  `react-dom/test-utils` (removed). `react-test-renderer` is deprecated on 19 — don't start new tests with it.

## Pure logic

- Utilities, reducers, selectors, schemas and query-key factories: plain unit tests, no rendering.
- Custom hooks: test through a small component or `renderHook` (from `@testing-library/react`, 13.1+);
  wrap with the providers they need.

## Component tests ([queries](https://testing-library.com/docs/queries/about#priority))

```tsx
it('shows the error when the email is invalid', async () => {
  const user = userEvent.setup();
  render(<SignupForm onSubmit={vi.fn()} />);
  await user.type(screen.getByLabelText(/email/i), 'nope');
  await user.click(screen.getByRole('button', { name: /sign up/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/valid email/i);
});
```

- Query priority: `getByRole` (with `name`) → `getByLabelText` → `getByPlaceholderText` → `getByText`
  → `getByTestId` as a last resort. Role queries double as accessibility checks.
- `userEvent` (`setup()` per test) over `fireEvent`; `await` every interaction.
- Async UI: `findBy*` / `waitFor` for things that appear; `waitForElementToBeRemoved` for loaders; never
  arbitrary `setTimeout`. `queryBy*` only to assert absence.
- Assert what the user sees or what leaves the component (callback called with exact args, request
  sent), not internal state, hook calls or CSS classes.
- One `renderWithProviders` helper (router, query client with `retry: false`, theme, i18n, store) shared by
  tests — create a fresh query client/store per test.
- Snapshots only for small, stable output and never updated blindly; no snapshot-only tests.
- Fake timers (`vi.useFakeTimers`/`jest.useFakeTimers`) with `userEvent.setup({ advanceTimers })`.

## Network

- Mock HTTP the project's way first (its golden test: `vi.mock`/`jest.mock` of the API module, MSW…). With no
  convention yet: MSW (`setupServer` in Node tests): handlers mirror the real contract; override per test
  for errors (`HttpResponse.json(..., { status: 500 })`), empty lists and slow responses.
- `onUnhandledRequest: 'error'` so an unexpected call fails the test.
- Don't mock your own API client or data hooks to test a component; mock the network edge. Mock
  third-party SDKs (analytics, maps) at their module boundary.

## Integration

- Render a whole route/page with the real router (`createMemoryRouter`/`MemoryRouter` at the target URL)
  and MSW: navigation, loader data, error boundary and redirects.
- Cover per feature: success, validation error, server error (with retry), empty state, loading state,
  permission denied — whichever apply ([`../workflow.md`](../workflow.md) §2).

## Accessibility checks

- `jest-axe`/`vitest-axe` on key components when the project has it; it complements, never replaces, role
  queries and keyboard tests (`user.tab()`, `user.keyboard('{Escape}')`).

## E2E (the project's tool — WebdriverIO, Cypress…; [Playwright](https://playwright.dev/docs/best-practices) if it has none)

- Critical user journeys only (sign-in, checkout, main CRUD); user-facing locators
  (`page.getByRole`, `getByLabel`), web-first assertions (`await expect(locator).toBeVisible()`), no fixed
  waits.
- Isolated state per test (API seeding, storage state for auth); never depend on another test's data.
- Run against the built app (`vite preview`/`next start`) or the dev server per the project's config;
  network to third parties mocked with `page.route` when they're not under test.
- Cypress projects: same principles with `cy.findByRole` (Testing Library plugin) and `cy.intercept`.

## Coverage & gates

- Coverage via the runner (`vitest --coverage` / `jest --coverage`); thresholds come from the project's
  config and gates, not from this file.
- Exclude stories, generated API types, `main.tsx` and barrel files only if the project already does;
  never exclude components with logic to hit a number.

## Mapping to the method

| Method step | React artifact |
|---|---|
| Test cases from the plan | One `describe` per component/hook behavior; titles state the rule |
| Failing tests first | Component test with RTL + the project's network mock; e2e spec for a new critical journey |
| Minimal code | Component + hook + API function (+ mock handler, if the project uses them), wired in the route |
| Done checklist | Unit/component + e2e green, build green, gates green, no `only`/`skip` |
