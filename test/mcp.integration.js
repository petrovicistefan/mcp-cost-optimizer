import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const client = new Client({ name: 'cost-optimizer-smoke', version: '1.0.0' });
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['src/index.js'] }));
  const { tools } = await client.listTools();
  assert.equal(tools.length, 3);
  const result = await client.callTool({ name: 'estimate_llm_cost', arguments: { record: { model: 'demo', inputTokens: 1000000, outputTokens: 0 }, rates: { currency: 'EUR', models: { demo: { inputPerMillion: 2, outputPerMillion: 3 } } } } });
  assert.equal(result.isError, undefined);
  assert.equal(JSON.parse(result.content[0].text).estimatedCost, 2);
  const invalid = await client.callTool({ name: 'estimate_llm_cost', arguments: { record: { model: 'unknown', inputTokens: 1, outputTokens: 0 }, rates: { currency: 'EUR', models: {} } } });
  assert.equal(invalid.isError, true);
  console.log('MCP stdio integration passed');
} finally { await client.close(); }
