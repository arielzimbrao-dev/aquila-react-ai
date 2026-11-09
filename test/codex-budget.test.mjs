// Codex concatenates the AGENTS.md files from the repository root down to the working folder and cuts at
// 32 KiB (project_doc_max_bytes): `check` fails when one such chain goes over it.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { aquila, cleanup, project } from './helpers.mjs';

const big = (kib) => `# Notes\n\n${'x'.repeat(kib * 1024)}\n`;
const put = (root, file, text) => {
  mkdirSync(join(root, file, '..'), { recursive: true });
  writeFileSync(join(root, file), text);
  execFileSync('git', ['add', file], { cwd: root });
};

test('check: an AGENTS.md chain over 32 KiB fails; separate branches are not added up', () => {
  const root = project();
  try {
    assert.equal(aquila(root, 'init', '--tools=codex', '--lint=off').code, 0);
    put(root, 'docs/AGENTS.md', big(20));
    put(root, 'src/AGENTS.md', big(20));
    const separate = aquila(root, 'check');
    assert.doesNotMatch(separate.out, /32 KiB/, 'docs/ and src/ are never read together');
    put(root, 'src/deep/AGENTS.md', big(14));
    const chain = aquila(root, 'check');
    assert.equal(chain.code, 1, chain.out);
    assert.match(chain.out, /src\/deep\/AGENTS\.md.*32 KiB/);
  } finally {
    cleanup(root);
  }
});
