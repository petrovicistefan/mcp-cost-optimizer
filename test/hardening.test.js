import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, open, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadJson } from '../src/index.js';
import { analyzeUsage } from '../src/core.js';
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'cost-hardening-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
test('reject oversized sparse file before reading JSON', async t => {
  const root = await fixture(t), h = await open(join(root, 'large.json'), 'w');
  await h.truncate(20 * 1024 * 1024 + 1); await h.close();
  await assert.rejects(loadJson('large.json', { root }), /20 MiB/);
});
test('reject directory', async t => {
  const root = await fixture(t);
  await assert.rejects(loadJson('.', { root }), /regular file/);
});
test('reject FIFO without blocking', { skip: process.platform === 'win32', timeout: 3000 }, async t => {
  const root = await fixture(t); execFileSync('mkfifo', [join(root, 'pipe')]);
  await assert.rejects(loadJson('pipe', { root }), /regular file/);
});
test('reject symlink to external data', { skip: process.platform === 'win32' }, async t => {
  const root = await fixture(t), outside = await fixture(t);
  await writeFile(join(outside, 'secret.json'), '{}');
  await symlink(join(outside, 'secret.json'), join(root, 'link.json'));
  await assert.rejects(loadJson('link.json', { root }), /inside/);
});
test('stream JSONL across UTF8 and chunk boundaries, CRLF and empty lines', async t => {
  const root = await fixture(t);
  const row = { text: 'a'.repeat(65520) + 'ș😀', model: 'demo' };
  await writeFile(join(root, 'data.jsonl'), '\n' + JSON.stringify(row) + '\r\n\n{"n":2}');
  assert.deepEqual(await loadJson('data.jsonl', { root, jsonl: true }), [row, { n: 2 }]);
});
test('JSONL reports physical error line and caps records', async t => {
  const root = await fixture(t);
  await writeFile(join(root, 'bad.jsonl'), '\n{}\ninvalid');
  await assert.rejects(loadJson('bad.jsonl', { root, jsonl: true }), /line 3/);
  await writeFile(join(root, 'many.jsonl'), '{}\n'.repeat(100001));
  await assert.rejects(loadJson('many.jsonl', { root, jsonl: true }), /100000/);
});
test('token overflow detected across models and unknown prices', () => {
  const rates = { currency: 'EUR', models: { a: { inputPerMillion: 0, outputPerMillion: 0 } } };
  const first = { model: 'a', inputTokens: Number.MAX_SAFE_INTEGER, outputTokens: 0 };
  const second = { model: 'unknown', inputTokens: 1, outputTokens: 0 };
  assert.throws(() => analyzeUsage([first, second], rates), /safe integer/);
  assert.equal(analyzeUsage([first], rates).tokenTotals.inputTokens, Number.MAX_SAFE_INTEGER);
});
