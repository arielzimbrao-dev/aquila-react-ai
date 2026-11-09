---
name: aquila-test-comment
description: >-
  Writes the "How to test" comment for non-dev QA (Markdown for the tracker) from the ticket and the code. Use for "how to test", "/aquila-test-comment".
model: haiku
---

# aquila-test-comment — "How to test" for QA

Project data (tracker, environment, app URL, browsers, test users): the `qa` block of
`docs/ai/aquila.json`; if missing, ask once and propose adding it. `qa.tracker` decides the format:
Jira Cloud, GitHub/GitLab and Azure DevOps accept Markdown; the Jira notes below apply only to Jira.

## Audience — golden rules

- **Non-dev QA**: plain language; start by explaining "what it is" in words.
- QA uses **only the app in the browser** (and the browser devtools). They do not touch code.
- Output **always in Markdown**, inside a ` ````markdown ` block (four backticks, so inner code blocks do
  not close it). Jira Cloud does not read wiki markup (`h3.`, `{code}`).
- **Simple but complete**: happy path + edge cases (empty, error, slow network, permissions) + expected
  result + evidence.
- Exact **URLs, button labels, field labels and messages** as they appear on screen, confirmed in the code
  (and in the i18n files when the project has them) — never paraphrased.
- Where QA gets credentials: name the source (`qa.testUser`, e.g. a password-manager vault); **never
  write passwords** in the comment.
- Separate what is **not for QA to validate** and **known non-bugs** (flag off, backend not deployed yet)
  into `> ⚠️` / `> ℹ️` quotes.

## Before writing

1. Read the ticket: goal, acceptance criteria, risks.
2. Read the task's code (diff): routes, components, visible texts, validations, feature flags, roles and
   the API calls the screen makes. **Never invent identifiers or texts** — confirm each one in the code.
3. Map each acceptance criterion to a verifiable step on screen. When the result is only visible in a
   request (e.g. a payload), say how to see it in devtools → Network.

## Structure (in this order)

````markdown
### How to test — <ID>: <short name>

**What it is:** <1–2 plain sentences>.

#### Setup

- Environment: **<qa.environment>** — <qa.appUrl>/<route>.
- Browsers: <qa.browsers>; also check a phone-width window if the screen is responsive.
- User: <role/profile> from <qa.testUser>.

> ⚠️ **Before starting:** confirm with dev/ops that these are on: `<FLAGS>`, and <preconditions>.

#### Steps

1. Open **<URL>** → you see **<what appears>**.
2. Click **"<button label>"** / fill **"<field label>"** with `<example value>` → **<expected result>**.

#### Edge cases

- Leave **"<field>"** empty and submit → message **"<exact text>"**.
- <Empty list / no permission / slow or offline network (devtools → Network → Slow 3G)> → <expected>.
- Keyboard only (Tab / Enter / Esc) → <what must still work>.

> ℹ️ **Not bugs:**
>
> - <known non-bug>.

#### Evidence to capture

- Screenshot of <screen/state> showing <expected state>; for errors, devtools Console and Network tabs.
````

## Content rules

- Always state **what "passed" means** — a concrete result on screen, never "check that it is ok".
- One action per step; placeholders only for QA's own values (`<date>`).
- Jira Markdown: `###`/`####`, `**bold**`, `` `code` ``, `1.`/`-` lists, warnings with `>`; `→`
  arrows; avoid tables.
