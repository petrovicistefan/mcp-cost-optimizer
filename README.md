# MCP Cost Optimizer

Local-first LLM/API cost analysis for AI agents, developers and teams. MIT licensed. Version 0.1.0 MVP.

## Install in your AI client

Works with any MCP client over stdio; no account or API key needed for the local server.

**Claude Code**

```sh
claude mcp add cost-optimizer -- npx -y mcp-cost-optimizer
```

**Codex CLI**

```sh
codex mcp add cost-optimizer -- npx -y mcp-cost-optimizer
```

**Claude Desktop, Cursor, Windsurf, Cline, Gemini CLI** — add to the client's MCP config (`claude_desktop_config.json`, `~/.cursor/mcp.json`, `~/.codeium/windsurf/mcp_config.json`, Cline MCP settings, `~/.gemini/settings.json`):

```json
{
  "mcpServers": {
    "cost-optimizer": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-cost-optimizer"
      ]
    }
  }
}
```

**VS Code / GitHub Copilot** — `.vscode/mcp.json`:

```json
{
  "servers": {
    "cost-optimizer": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "mcp-cost-optimizer"
      ]
    }
  }
}
```

**Zed** — `settings.json`:

```json
{
  "context_servers": {
    "cost-optimizer": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-cost-optimizer"
      ]
    }
  }
}
```

## Status

Core calculations and CLI tested. MCP SDK integration test is provided but could not be executed in the authoring environment because npm registry access is blocked. Run the full validation below before publishing. Package is not yet published to npm. No lockfile is included; generate and commit one after installing in your environment, then use `npm ci` in CI.

## Quick start from source

Requires Node.js 20+.

```sh
npm install --ignore-scripts
npm run check
npm test
node test/mcp.integration.js
node src/index.js analyze examples/usage.jsonl examples/rates.json demo-budget
```

The CLI and core have no external dependencies. The MCP server uses the official TypeScript SDK v1 and Zod. No compilation is needed.

Configure your MCP host with an absolute path:

```json
{
  "mcpServers": {
    "cost-optimizer": {
      "command": "node",
      "args": ["/absolute/path/mcp-cost-optimizer/src/index.js"]
    }
  }
}
```

## Tools

| Tool | Input | Result |
| --- | --- | --- |
| `estimate_llm_cost` | `record`, `rates` | Single-request estimate |
| `analyze_llm_usage` | `records`, `rates` | Costs by model, unpriced models, duplicate opportunity |
| `compare_llm_models` | `records`, `rates`, `targetModel` | Independent migration scenario |

Ask your agent: “Analyze these normalized usage records with my supplied rates. Identify unknown models and repeated requests, then compare a cheaper model. Explain assumptions and do not change production routing.”

## Data contract

`record`: `model`, `inputTokens`, `outputTokens`, optional `cachedInputTokens` and `requestHash`. Input includes cached tokens; counts must be nonnegative safe integers. Usage must be normalized before import. OpenAI-style `prompt_tokens` and Anthropic cache fields are not accepted directly. Do not blindly map Anthropic input counts: sum ordinary input, cache-read and cache-write tokens first; cache-write pricing needs separate treatment and is unsupported in this MVP.

`rates`: three-letter `currency`, optional `asOf`, and `models` keyed by exact model name. Each model supplies `inputPerMillion`, `outputPerMillion` and optional `cachedInputPerMillion`. All models share the same supplied currency. Missing cache price falls back to normal input price. Real provider prices and currency conversion are deliberately not bundled; example rates are fictional. Unknown model costs are excluded and the report is marked incomplete; comparisons reject incomplete baselines.

`requestHash` must identify the entire effective request, including tenant, model parameters, system context, tool state and freshness requirements. Repeated hashes identify conditional response caching, not provider prompt caching. The first request is retained. Estimated duplicate savings are an upper bound, assume safe reuse and exclude cache infrastructure cost. Raw prompts are unnecessary. No hash means no duplicate assessment. Use a keyed hash when inputs may be guessable.

Model comparisons keep observed token counts, reset cached tokens to zero and require quality, tokenizer, tool support, latency and context-window evaluation. A more expensive target can return negative savings. Scenarios must not be added together. No invoice reconciliation, taxes or automatic routing.

## Privacy and limits

No telemetry, outbound requests, provider credentials or stored usage. MCP tools accept supplied structured data and cannot read files. CLI reads JSON/JSONL under its current directory, resolves symlinks and rejects paths outside that root. Limit: 100,000 records and 20 MiB per CLI file. Files are checked for regular-file type and size before reading, then read in bounded chunks with a second byte limit. JSONL is parsed incrementally and capped at 100,000 records. Descriptor identity is checked at open; this is defense in depth, not a sandbox against concurrent replacement of ancestor directories. Aggregated token counts reject unsafe integer totals, including records with unknown prices. The tool does not automatically observe other MCP/API calls.

## Hosted path (quotas via control plane)

Local MCP/CLI stay free and offline. Quotas apply only on a hosted HTTP process that reserves units on mcp-control-plane before analysis.

```sh
cp .env.example .env   # set CONTROL_PLANE_URL
npm run start:hosted   # default 127.0.0.1:3102
```

| Method | Path | Body |
| --- | --- | --- |
| GET | `/health` | Liveness |
| POST | `/v1/estimate` | `{ "requestId", "record", "rates" }` |
| POST | `/v1/analyze` | `{ "requestId", "records", "rates" }` |
| POST | `/v1/compare` | `{ "requestId", "records", "rates", "targetModel" }` |

Requires `Authorization: Bearer mcp_…`. Usage records and rates stay on the hosted host; control-plane sees only `product`, `requestId`, and `units`.

## Free and Pro

Local analysis stays free. Hosted Pro quotas use the control-plane path above (history, budgets, alerts remain future).

## Roadmap

Provider adapters (including cache-write and reasoning token accounting), verified versioned pricing, project budgets, quality-gated model evaluation, hosted reporting. Validate these with real usage before adding automatic optimizations.
