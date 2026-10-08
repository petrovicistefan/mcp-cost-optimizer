#!/usr/bin/env node
import { open, realpath, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeUsage, compareModels } from './core.js';
export async function loadJson(path, { jsonl = false, root = process.cwd() } = {}) {
  const base = await realpath(root);
  const file = await realpath(resolve(base, path));
  const rel = relative(base, file);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('File must be inside the configured root');
  const maxBytes = 20 * 1024 * 1024;
  const before = await stat(file);
  if (!before.isFile()) throw new Error('Input must be a regular file');
  if (before.size > maxBytes) throw new Error('File exceeds 20 MiB limit');
  // Nonblocking prevents an unexpected FIFO from hanging open on POSIX.
  const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile()) throw new Error('Input must be a regular file');
    if (opened.dev !== before.dev || opened.ino !== before.ino) throw new Error('Input changed during open');
    if (opened.size > maxBytes) throw new Error('File exceeds 20 MiB limit');
    const decoder = new StringDecoder('utf8');
    const chunk = Buffer.alloc(64 * 1024);
    let total = 0, pending = '', line = 0;
    const records = [];
    const parseLine = value => {
      line++;
      if (!value.trim()) return;
      if (records.length >= 100000) throw new Error('JSONL exceeds 100000 records');
      try { records.push(JSON.parse(value)); } catch { throw new Error(`Invalid JSONL at line ${line}`); }
    };
    while (true) {
      const { bytesRead } = await handle.read(chunk, 0, Math.min(chunk.length, maxBytes - total + 1), null);
      if (!bytesRead) break;
      total += bytesRead;
      if (total > maxBytes) throw new Error('File exceeds 20 MiB limit');
      pending += decoder.write(chunk.subarray(0, bytesRead));
      if (jsonl) {
        let start = 0, end;
        while ((end = pending.indexOf('\n', start)) !== -1) { parseLine(pending.slice(start, end)); start = end + 1; }
        pending = pending.slice(start);
      }
    }
    pending += decoder.end();
    if (jsonl) { parseLine(pending); return records; }
    return JSON.parse(pending);
  } finally { await handle.close(); }
}
export async function main(args) {
  if (!args.length || args[0] === 'serve') { const { serve } = await import('./server.js'); await serve(); return; }
  if (args[0] === '--help') { console.log('mcp-cost-optimizer [serve | analyze USAGE.json[l] RATES.json [TARGET_MODEL]]\nFiles must be under the current working directory. Prices are supplied by you.'); return; }
  if (args[0] !== 'analyze' || args.length < 3 || args.length > 4) throw new Error('Usage: analyze USAGE.json[l] RATES.json [TARGET_MODEL]');
  const records = await loadJson(args[1], { jsonl: args[1].endsWith('.jsonl') });
  const rates = await loadJson(args[2]);
  console.log(JSON.stringify({ report: analyzeUsage(records, rates), ...(args[3] ? { comparison: compareModels(records, rates, args[3]) } : {}) }, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exitCode = 1; });
