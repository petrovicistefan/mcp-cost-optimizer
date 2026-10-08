#!/usr/bin/env node
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeUsage, compareModels } from './core.js';
export async function loadJson(path, { jsonl = false, root = process.cwd() } = {}) {
  const base = await realpath(root);
  const file = await realpath(resolve(base, path));
  const rel = relative(base, file);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('File must be inside the configured root');
  const buffer = await readFile(file);
  if (buffer.length > 20 * 1024 * 1024) throw new Error('File exceeds 20 MiB limit');
  const text = buffer.toString('utf8');
  return jsonl ? text.split(/\r?\n/).filter(s => s.trim()).map((s,i) => { try { return JSON.parse(s); } catch { throw new Error(`Invalid JSONL at nonempty record ${i + 1}`); } }) : JSON.parse(text);
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
