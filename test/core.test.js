import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeUsage, compareModels, estimateCost } from '../src/core.js';
import { loadJson, main } from '../src/index.js';
const rates = { currency: 'EUR', models: { premium: { inputPerMillion: 10, outputPerMillion: 20, cachedInputPerMillion: 2 }, budget: { inputPerMillion: 1, outputPerMillion: 2 } } };
const row = { model: 'premium', inputTokens: 1000000, cachedInputTokens: 500000, outputTokens: 1000000, requestHash: 'complete-request-a' };
test('prices cached input as part of total input', () => assert.equal(estimateCost(row, rates).estimatedCost, 26));
test('cache rate absent falls back to normal input', () => assert.equal(estimateCost({ ...row, model: 'budget' }, rates).estimatedCost, 3));
test('duplicates exclude first occurrence and separate models', () => {
  const report = analyzeUsage([row, row, { ...row, model: 'budget' }], rates);
  assert.equal(report.estimatedCost, 55); assert.equal(report.responseCaching.upperBoundSavings, 26); assert.equal(report.responseCaching.duplicateRequests, 1);
});
test('unknown model makes report incomplete without silently assigning zero pricing', () => {
  const report = analyzeUsage([{ ...row, model: 'unknown' }, row], rates);
  assert.equal(report.complete, false); assert.equal(report.unpricedRequests, 1); assert.deepEqual(report.unknownModels, ['unknown']);
  assert.throws(() => compareModels([{ ...row, model: 'unknown' }], rates, 'budget'));
});
test('comparison starts target cache cold', () => {
  assert.equal(compareModels([row], rates, 'budget').targetCost, 3);
  assert.equal(compareModels([row], rates, 'premium').targetCost, 30);
});
test('invalid token data and rates rejected', () => {
  for (const v of [-1, NaN, Infinity, 0.5, '3', Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => estimateCost({ ...row, inputTokens: v }, rates));
  assert.throws(() => estimateCost({ ...row, cachedInputTokens: 1000001 }, rates));
  assert.throws(() => analyzeUsage([row], { ...rates, models: { premium: { inputPerMillion: -1, outputPerMillion: 2 } } }));
  assert.throws(() => estimateCost({ ...row, model: 'toString' }, rates));
  assert.throws(() => analyzeUsage([row], { ...rates, currency: 'eur' }));
});
test('empty usage and free rates avoid NaN', () => {
  assert.equal(analyzeUsage([], rates).estimatedCost, 0);
  assert.equal(compareModels([], rates, 'budget').savingsPercent, 0);
});
test('CLI path confinement rejects traversal', async () => {
  await assert.rejects(loadJson('../package.json', { root: new URL('../examples', import.meta.url).pathname }), /inside/);
});
test('example JSONL loads and computes expected cost', async () => {
  const root = new URL('../examples', import.meta.url).pathname;
  const rows = await loadJson('usage.jsonl', { root, jsonl: true });
  const prices = await loadJson('rates.json', { root });
  assert.equal(analyzeUsage(rows, prices).estimatedCost, 0.0072);
});
test('CLI invalid arguments rejected', async () => { await assert.rejects(main(['wrong']), /Usage/); });
