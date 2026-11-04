#!/usr/bin/env node
// PreToolUse (Bash/PowerShell): blocks what aquila-react-ai forbids (core/done.md) and an agent may try in
// order to "unblock" a gate — skipping git hooks or rewriting the remote. Exit 2 = block and return the
// reason to the agent. Git hooks and CI remain the real gate; this only cuts the shortcut earlier.
// Only looks at command segments that invoke `git` (split on && || ; | and newlines), so text that
// merely mentions the flag (echo, grep, sed, doc heredocs) is not blocked.
import { readFileSync } from 'node:fs';

const SKIP_HOOKS =
  'never skip git hooks (.aquila/core/done.md): fix the cause the gate reported';
const FORCE_PUSH = 'force push forbidden: use --force-with-lease and only on request';
// Hook dirs that may be (re)set: the aquila dispatcher (and the pre-0.2.0 dir) and husky's
// (v9 `.husky/_`, v4–8 `.husky`).
const HOOK_DIRS = String.raw`(?:\.aquila-hooks|\.aquila/githooks|\.husky(?:/_)?)/?`;
// `git [global options] <sub>`: the subcommand after git, not the word elsewhere
// (`git log --grep=commit -n 5` is not a commit).
const sub = (name) =>
  new RegExp(String.raw`\bgit(?:\s+-[cC]\s+\S+|\s+--?[\w.-]+(?:=\S+)?)*\s+${name}\b`).source;
const RULES = [
  [/(^|\s)--no-verify(\s|$|['"])/, SKIP_HOOKS],
  // `git commit -n` is the --no-verify shorthand (also grouped: -an, -nm…).
  [new RegExp(`${sub('commit')}.*\\s-(?!-)[a-zA-Z]*n[a-zA-Z]*(\\s|$|['"])`), SKIP_HOOKS],
  // Redirecting hooks to another dir (e.g. /dev/null) is skipping them.
  [/\s-c\s*core\.hooksPath\s*=/i, SKIP_HOOKS],
  // …and permanently too (`git config core.hooksPath x`, `--unset`); only HOOK_DIRS pass.
  [
    new RegExp(
      String.raw`${sub('config')}(?!.*\s--get).*core\.hooksPath(?!\s+['"]?${HOOK_DIRS}['"]?\s*$)`,
      'i',
    ),
    SKIP_HOOKS,
  ],
  [new RegExp(`${sub('push')}.*(\\s--force(?!-with-lease)\\b|\\s-f(\\s|$|['"]))`), FORCE_PUSH],
  // A `+` refspec (git push origin +main) forces the update like --force.
  [new RegExp(`${sub('push')}.*\\s\\+[^\\s'"]+`), FORCE_PUSH],
];
// `HUSKY=0 git commit`, `export HUSKY=0; git …`, `$env:HUSKY=0; git …` (PowerShell), HUSKY_SKIP_HOOKS
// (husky ≤ 4): husky does not run the hooks. Applies to the whole command, as long as a segment calls git.
const HUSKY_ENV = /(^|[\s(])(\$env:)?HUSKY(_SKIP_HOOKS)?\s*=/i;
// The commit message (`-m "… -n …"`, `-am x`) is not flags: strip it before the rules; the flag stays.
const MESSAGE = /\s(-[a-zA-Z]*m|--message)(?:=|\s+)(?:"(?:[^"\\]|\\.)*"|'[^']*'|\S+)/g;
const IS_GIT = /(^|[\s'"(])git(\s|$)/;

/** Line without the shell comment (` # …` outside quotes). */
function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

/** Block reason, or null. */
export function blocked(command) {
  const segments = command
    .split(/\r?\n/)
    .flatMap((line) => stripComment(line).split(/&&|\|\||;|\|/))
    .map((raw) => raw.replaceAll(MESSAGE, ' $1'));
  const git = segments.filter((s) => IS_GIT.test(s));
  if (!git.length) return null;
  if (segments.some((s) => HUSKY_ENV.test(s))) return SKIP_HOOKS;
  for (const segment of git) {
    const hit = RULES.find(([re]) => re.test(segment));
    if (hit) return hit[1];
  }
  return null;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop());
if (isMain) {
  let command = '';
  try {
    command = JSON.parse(readFileSync(0, 'utf8') || '{}')?.tool_input?.command ?? '';
  } catch {
    process.exit(0); // stdin that is not the hook JSON: not our business
  }
  const reason = typeof command === 'string' && blocked(command);
  if (reason) {
    console.error(`Blocked by the aquila-react-ai hook: ${reason}.`);
    process.exit(2);
  }
}
