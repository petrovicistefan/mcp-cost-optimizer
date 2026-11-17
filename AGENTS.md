# AGENTS.md

Hard rules for anyone (human or AI agent) changing this repo. Each rule is enforced by `npm run check:rules` (`scripts/check-rules.mjs`), which is part of `prepublishOnly`. Do not weaken a check to make a change pass.

## Rules

1. **Version sync.** `package.json` `version` must equal `server.json` `version` and every `server.json` `packages[].version`. Bump all of them together.
2. **One version source.** `serverInfo.version` comes from `package.json` through `src/version.js` (`VERSION`). Never write the version as a string literal in `src`.
3. **Local-first.** The stdio MCP server and CLI run fully offline. Only the opt-in hosted path (`src/hosted.js`, `src/control-plane-client.js`) may use the network. No other file may use `fetch`, `http`/`https`, `net`, WebSocket or similar.
4. **No telemetry.** No analytics, tracking or crash-reporting dependencies or endpoints, and nothing is sent anywhere by default.
5. **No secrets or user data in logs.** Usage records, rates, request bodies, headers, API keys and tokens must never be logged. `src/server.js` is the stdio protocol channel and must not use `console.*`. `console.log` outside the CLI (`src/index.js`, whose job is to print the analysis) may only print a constant string.
6. **Docs stay in step.** `AGENTS.md`, `docs/PRODUCT.md` and `CHANGELOG.md` must exist, and `CHANGELOG.md` needs an `Unreleased` or current-version heading.
7. **Release scripts exist.** `package.json` keeps `check`, `check:rules`, `test`, `test:integration` and a `prepublishOnly` that runs them.

## Commands

```bash
npm run check             # node --check on the sources
npm run check:rules       # the AGENTS.md rules above
npm test                  # unit tests (includes the version test)
npm run test:integration  # stdio initialize + tools/list + version + tool calls
```

## Do not

- Publish to npm or the MCP Registry from a working branch; releases go through a `v*.*.*` tag and `.github/workflows/release.yml`.
- Add prices, network lookups or file writes to the MCP tools. Prices are always supplied by the caller.
