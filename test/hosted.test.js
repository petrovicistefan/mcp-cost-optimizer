import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHostedServer } from '../src/hosted.js';
import { consume } from '../src/control-plane-client.js';

const controlPlaneRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'mcp-control-plane');
const { Store } = await import(join(controlPlaneRoot, 'src', 'store.js'));
const { createServer } = await import(join(controlPlaneRoot, 'src', 'server.js'));

const rates = {
  currency: 'USD',
  models: { 'gpt-test': { inputPerMillion: 1, outputPerMillion: 2 } },
};
const record = { model: 'gpt-test', inputTokens: 1000, outputTokens: 500 };

async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

test('hosted estimate consumes quota; records never reach control plane', async t => {
  const store = new Store();
  const admin = 'a'.repeat(32);
  const controlPlane = createServer({ store, adminToken: admin, limits: { free: 2, paid: 10 } });
  const controlPlaneUrl = await listen(controlPlane);
  const consumeCalls = [];
  const consumeImpl = async opts => {
    const result = await consume(opts);
    consumeCalls.push(result.payload);
    return result;
  };
  const hosted = createHostedServer({ controlPlaneUrl, consumeImpl });
  const hostedUrl = await listen(hosted);
  t.after(async () => {
    await Promise.all([
      new Promise(resolve => controlPlane.close(resolve)),
      new Promise(resolve => hosted.close(resolve)),
    ]);
    store.close();
  });

  const adminCall = async (path, body) => {
    const response = await fetch(`${controlPlaneUrl}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const hostedCall = async (path, token, body) => {
    const response = await fetch(`${hostedUrl}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };

  assert.equal((await adminCall('/v1/admin/accounts', { accountId: 'cost-1' })).status, 201);
  const { key } = (await adminCall('/v1/admin/keys', { accountId: 'cost-1' })).body;

  const first = await hostedCall('/v1/estimate', key, { requestId: 'e1', record, rates });
  assert.equal(first.status, 200);
  assert.equal(first.body.report.model, 'gpt-test');
  assert.equal(first.body.usage.product, 'cost-optimizer');

  assert.equal((await hostedCall('/v1/analyze', key, {
    requestId: 'a1',
    records: [record],
    rates,
  })).status, 200);

  assert.equal((await hostedCall('/v1/compare', key, {
    requestId: 'c1',
    records: [record],
    rates,
    targetModel: 'gpt-test',
  })).status, 429);

  for (const payload of consumeCalls) {
    assert.deepEqual(Object.keys(payload).sort(), ['product', 'requestId', 'units']);
    assert.equal(payload.product, 'cost-optimizer');
    assert.equal('records' in payload, false);
    assert.equal('rates' in payload, false);
  }
});
