import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';
import { VERSION } from '../src/version.js';

const readJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

test('package.json, server.json and the runtime version agree', async () => {
  const pkg = readJson('../package.json');
  const server = readJson('../server.json');
  assert.match(pkg.version, /^\d+\.\d+\.\d+/);
  assert.equal(server.version, pkg.version, 'server.json top-level version');
  assert.ok(server.packages.length > 0);
  for (const entry of server.packages) assert.equal(entry.version, pkg.version, 'server.json packages[].version');
  assert.equal(VERSION, pkg.version, 'exported VERSION');

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'version-test', version: '1.0.0' });
  await Promise.all([createServer().connect(serverTransport), client.connect(clientTransport)]);
  try {
    assert.equal(client.getServerVersion()?.version, pkg.version, 'serverInfo.version');
  } finally {
    await client.close();
  }
});
