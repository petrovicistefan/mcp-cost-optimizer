import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { analyzeUsage, estimateCost, compareModels } from './core.js';
const tokens = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const record = z.object({ model: z.string().min(1), inputTokens: tokens, outputTokens: tokens, cachedInputTokens: tokens.optional(), requestHash: z.string().min(1).max(512).optional() });
const rates = z.object({ currency: z.string().regex(/^[A-Z]{3}$/), asOf: z.string().optional(), models: z.record(z.object({ inputPerMillion: z.number().finite().nonnegative(), outputPerMillion: z.number().finite().nonnegative(), cachedInputPerMillion: z.number().finite().nonnegative().optional() })) });
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
export function createServer() {
  const server = new McpServer({ name: 'mcp-cost-optimizer', version: '0.1.1' });
  const register = (name, description, inputSchema, fn) => server.registerTool(name, { description, inputSchema, annotations }, async args => {
    try { const result = fn(args); return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result }; }
    catch (e) { return { isError: true, content: [{ type: 'text', text: e.message }] }; }
  });
  register('estimate_llm_cost', 'Estimate one LLM request from supplied per-million token rates. Input tokens include cached tokens.', { record, rates }, a => estimateCost(a.record, a.rates));
  register('analyze_llm_usage', 'Analyze normalized LLM usage; report costs, unknown models and conditional response-cache opportunities. No network or file access.', { records: z.array(record).max(100000), rates }, a => analyzeUsage(a.records, a.rates));
  register('compare_llm_models', 'Compare a target model with known-price baseline. Scenario only; requires quality evaluation and does not change routing.', { records: z.array(record).max(100000), rates, targetModel: z.string().min(1) }, a => compareModels(a.records, a.rates, a.targetModel));
  return server;
}
export async function serve() { await createServer().connect(new StdioServerTransport()); }
