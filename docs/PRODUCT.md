# MCP Cost Optimizer: product facts

Sources: `README.md`, `package.json`, `server.json`, `src/`. Update this file when those change.

## What it is

A local-first MCP server (and small CLI) that estimates LLM costs from normalized usage records and caller-supplied per-million-token rates, and models "what if we switched models" scenarios. Package `mcp-cost-optimizer`, MCP name `io.github.petrovicistefan/mcp-cost-optimizer`, stdio transport, MIT licensed.

## What it is NOT

- Not a source of prices: you supply the rates file; nothing is fetched and there is no pricing catalog.
- Not invoice reconciliation: no taxes, no currency conversion; estimates only.
- Not a model router: it never changes which model an application uses.
- Not a quality evaluator: model comparisons keep token counts constant and ignore quality, tokenizer differences, context window, tool support and latency.
- Not a parser of raw provider exports: OpenAI and Anthropic usage must be normalized first (see the README).

## Users

AI-agent users and developers (Cursor, Claude Code, VS Code, Claude Desktop, Windsurf, Cline, Codex CLI, Zed, Gemini CLI) who have usage logs and want cost totals, model-switch savings and cache-opportunity estimates.

## Tools (read-only, idempotent, no network or file access)

| Tool | Input | Output |
|------|-------|--------|
| `estimate_llm_cost` | `record`, `rates` | Cost estimate for one request; input tokens include cached tokens |
| `analyze_llm_usage` | `records` (max 100,000), `rates` | Total cost, per-model breakdown, unknown models, conditional response-cache opportunities (needs `requestHash`), token totals |
| `compare_llm_models` | `records` (max 100,000), `rates`, `targetModel` | Scenario cost of a target model against the known-price baseline |

Unknown models are excluded from totals and the result is marked incomplete.

## CLI

`mcp-cost-optimizer [serve | analyze USAGE.json[l] RATES.json [TARGET_MODEL]]`. `serve` (or no arguments) starts the stdio server. `analyze` reads JSON/JSONL files that must be under the current working directory (symlinks resolved, regular files only, at most 20 MiB, JSONL capped at 100,000 records) and prints a report.

## Runtime modes

- **Local stdio MCP server / CLI**: no outbound requests, no accounts, no API keys.
- **Hosted HTTP path** (`npm run start:hosted`, `src/hosted.js`): opt-in. `GET /health`, `/v1/estimate`, `/v1/analyze`, `/v1/compare`. It reserves quota against a control plane (`CONTROL_PLANE_URL`); usage records and rates are not sent to the control plane.

## Pricing

Per the README: the local MCP server and CLI are free forever. A hosted path with centralized quotas, budgets and alerts is planned; its pricing is TBD.

## Known limitations

- No cache-write pricing; `cachedInputPerMillion` applies to cache reads only.
- Reasoning tokens are not priced separately.
- You maintain the rates file; all models in it must use one currency.
- Response-cache savings are an upper bound based on duplicate `requestHash` values, not provider prompt caching.

## Requirements

Node.js >= 20. Runtime dependencies: `@modelcontextprotocol/sdk`, `zod`.
