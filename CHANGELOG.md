# Changelog

## 0.1.2 (2026-10-19)

**Documentation-only patch release** to optimize GitHub discoverability and improve onboarding.

### README Improvements

- **Compelling hook**: "See what your LLM calls cost and how much you'd save by switching models — local MCP server, no API keys."
- **Badges added**: npm version, downloads, CI status, MIT license
- **Quickstart moved to top**: Claude Code plugin commands and npx one-liner in first screen
- **Star CTA**: Strategic placement after quickstart
- **Table of contents**: Easy navigation through longer README
- **Importing Usage Data section**: Clear examples for normalizing OpenAI and Anthropic usage exports into the expected format (addresses audit feedback that "the hook is weak because it needs normalized usage records")
- **Use cases section**: AI agent cost audit, model migration planning, cache opportunity detection, individual/freelancer, team/enterprise
- **Comparison table**: MCP Cost Optimizer vs agentacct, Tokenscope, tokentop, llm-cost-dashboard — highlighting MCP-native integration, model comparison, request-level cache detection, provider-agnostic design
- **Limitations section**: Moved disclaimers (cache-write pricing, reasoning tokens, no invoice reconciliation, quality evaluation) out of opening lines into dedicated section
- **MCP suite footer**: "Part of the petrovicistefan MCP suite" with table of sibling servers (mcp-security-guard, mcp-database-doctor, mcp-dependency-doctor, mcp-seo-auditor, mcp-api-guardian, mcp-marketplace)
- **Improved structure**: Quickstart → Why → Example Prompts → Tools → Importing Data → Use Cases → Privacy → Comparison → Limitations → Free/Pro → Roadmap → Contributing → License → More MCP Servers

### Technical Details

- No code changes
- No API changes
- All existing content preserved
- All commands verified against actual package.json bin and code

## 0.1.1 (2026-10-08)

- Re-release with the version reported by the server aligned to the package version. No functional changes compared to 0.1.0.

## 0.1.0 (2026-10-08)

- First public release (MVP): published on npm, the official MCP Registry and the petrovicistefan MCP marketplace.
