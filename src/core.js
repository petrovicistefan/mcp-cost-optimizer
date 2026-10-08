const MAX_RECORDS = 100000;
const own = (o, k) => Object.hasOwn(o, k);
function number(value, field, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (integer && !Number.isSafeInteger(value))) throw new Error(`${field} must be a finite nonnegative ${integer ? 'safe integer' : 'number'}`);
  return value;
}
export function validateRates(rates) {
  if (!rates || typeof rates !== 'object' || Array.isArray(rates) || !rates.models || typeof rates.models !== 'object' || Array.isArray(rates.models)) throw new Error('rates.models must be an object');
  if (!/^[A-Z]{3}$/.test(rates.currency ?? '')) throw new Error('rates.currency must be a three-letter currency code');
  for (const [name, rate] of Object.entries(rates.models)) {
    if (!name || !rate || typeof rate !== 'object') throw new Error('Invalid model rate');
    number(rate.inputPerMillion, `${name}.inputPerMillion`);
    number(rate.outputPerMillion, `${name}.outputPerMillion`);
    if (rate.cachedInputPerMillion !== undefined) number(rate.cachedInputPerMillion, `${name}.cachedInputPerMillion`);
  }
  return rates;
}
export function validateRecords(records) {
  if (!Array.isArray(records) || records.length > MAX_RECORDS) throw new Error(`records must be an array with at most ${MAX_RECORDS} entries`);
  return records.map((r, i) => {
    if (!r || typeof r !== 'object' || typeof r.model !== 'string' || !r.model) throw new Error(`Record ${i}: model is required`);
    number(r.inputTokens, `Record ${i}.inputTokens`, true);
    number(r.outputTokens, `Record ${i}.outputTokens`, true);
    const cachedInputTokens = r.cachedInputTokens ?? 0;
    number(cachedInputTokens, `Record ${i}.cachedInputTokens`, true);
    if (cachedInputTokens > r.inputTokens) throw new Error(`Record ${i}: cached tokens exceed total input`);
    if (r.requestHash !== undefined && (typeof r.requestHash !== 'string' || !r.requestHash)) throw new Error(`Record ${i}: requestHash must be a nonempty string`);
    return { ...r, cachedInputTokens };
  });
}
function cost(r, rate) {
  return ((r.inputTokens - r.cachedInputTokens) * rate.inputPerMillion + r.cachedInputTokens * (rate.cachedInputPerMillion ?? rate.inputPerMillion) + r.outputTokens * rate.outputPerMillion) / 1e6;
}
export function estimateCost(record, rates) {
  validateRates(rates);
  const [r] = validateRecords([record]);
  if (!own(rates.models, r.model)) throw new Error(`No pricing for model: ${r.model}`);
  const estimatedCost = cost(r, rates.models[r.model]);
  if (!Number.isFinite(estimatedCost)) throw new Error('Cost overflow');
  return { model: r.model, currency: rates.currency, estimatedCost, pricingAsOf: rates.asOf ?? null };
}
export function analyzeUsage(records, rates) {
  validateRates(rates);
  const rows = validateRecords(records);
  const byModel = new Map(), seen = new Set(), unknown = new Set();
  let totalCost = 0, duplicateCost = 0, duplicateRequests = 0, pricedRequests = 0;
  for (const r of rows) {
    if (!own(rates.models, r.model)) { unknown.add(r.model); continue; }
    const c = cost(r, rates.models[r.model]);
    if (!Number.isFinite(c)) throw new Error('Cost overflow');
    pricedRequests++; totalCost += c;
    const group = byModel.get(r.model) ?? { model: r.model, requests: 0, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, estimatedCost: 0 };
    group.requests++; group.inputTokens += r.inputTokens; group.outputTokens += r.outputTokens; group.cachedInputTokens += r.cachedInputTokens; group.estimatedCost += c;
    byModel.set(r.model, group);
    if (r.requestHash) {
      const key = JSON.stringify([r.model, r.requestHash]);
      if (seen.has(key)) { duplicateRequests++; duplicateCost += c; }
      seen.add(key);
    }
  }
  if (!Number.isFinite(totalCost)) throw new Error('Total cost overflow');
  return {
    currency: rates.currency, pricingAsOf: rates.asOf ?? null,
    requests: rows.length, pricedRequests, unpricedRequests: rows.length - pricedRequests,
    complete: pricedRequests === rows.length, estimatedCost: totalCost,
    unknownModels: [...unknown].sort(), byModel: [...byModel.values()].sort((a,b) => b.estimatedCost - a.estimatedCost),
    responseCaching: { duplicateRequests, upperBoundSavings: duplicateCost, note: 'Upper bound only; requires identical full request, tenant, parameters, tool state and freshness. requestHash must capture these. Not provider prompt caching.' },
    note: 'Supplied prices; no taxes, exchange conversion or invoice reconciliation. Unknown models are excluded from totals.'
  };
}
export function compareModels(records, rates, targetModel) {
  const baseline = analyzeUsage(records, rates);
  if (!baseline.complete) throw new Error('Cannot compare: baseline has unknown model prices');
  if (!own(rates.models, targetModel)) throw new Error(`No pricing for model: ${targetModel}`);
  // A model migration cannot assume source provider cache hits carry over.
  const target = analyzeUsage(records.map(r => ({ ...r, model: targetModel, cachedInputTokens: 0 })), rates);
  return { currency: rates.currency, baselineCost: baseline.estimatedCost, targetModel, targetCost: target.estimatedCost, estimatedSavings: baseline.estimatedCost - target.estimatedCost, savingsPercent: baseline.estimatedCost ? (baseline.estimatedCost - target.estimatedCost) / baseline.estimatedCost * 100 : 0, note: 'Same token counts are assumed; actual tokenizer, quality, context window, tools and latency require evaluation. Target cache starts cold. Savings may be negative. Do not add this scenario to response-cache savings.' };
}
