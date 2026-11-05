# feegate-yield-mcp

[![Glama MCP Score](https://glama.ai/mcp/servers/BrianTian818/feegate-yield-mcp/badges/score.svg)](https://glama.ai/mcp/servers/BrianTian818/feegate-yield-mcp)
[![GitHub release](https://img.shields.io/github/v/release/BrianTian818/feegate-yield-mcp)](https://github.com/BrianTian818/feegate-yield-mcp/releases)
[![License: MIT](https://img.shields.io/github/license/BrianTian818/feegate-yield-mcp)](LICENSE)
[![Node >=18](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=nodedotjs)](https://nodejs.org/)

**Free, open-source MCP server for DeFi yield data.** Search APY / TVL across 60+ chains and 10,000+ pools — no API key, no account, no dependencies.

Data: [DefiLlama](https://defillama.com/yields) public yields API · License: MIT · Node.js ≥ 18

> 🚀 Brought to you by **[Feegate](https://feegate.org)** — the x402 data marketplace where AI agents buy data per call in USDC on Base. Free tools, paid data, no API keys: [feegate.org](https://feegate.org)

---

## Why

AI agents (Claude, Cursor, ChatGPT, custom agents) increasingly need live DeFi yield data — "which pools pay the best APY on Base?", "show me stablecoin farms above $50M TVL". This MCP server gives any MCP-compatible client that ability in one config line, for free.

It also demonstrates the Feegate thesis: **data should be something an agent can discover, price and call — not something a human has to subscribe to.**

## Tools

| Tool | What it does | Cost |
|---|---|---|
| `list_chains` | All chains with yield pools, ranked by TVL | Free |
| `get_pools` | Top pools by TVL, filter by `chain` / `min_tvl` / `stablecoin_only`; returns total/base/reward APY, 30d mean, IL risk | Free |
| `get_project_yields` | All pools of one protocol (e.g. `aave-v3`), across chains | Free |

Results are cached 5 minutes server-side. Each pool includes `apy_base` vs `apy_reward` split so agents can avoid unsustainable incentive APYs.

## Install (Claude Code / CLI)

```bash
claude mcp add feegate-yield -- node /path/to/feegate-yield-mcp/index.js
```

## Cursor / Claude Desktop (`mcpServers` JSON)

```json
{
  "mcpServers": {
    "feegate-yield": {
      "command": "node",
      "args": ["/path/to/feegate-yield-mcp/index.js"]
    }
  }
}
```

No `npm install` needed — plain Node.js, zero dependencies.

## Example questions your agent can now answer

- "What are the top 10 yield pools on Base by TVL, and which ones are stablecoin?"
- "Compare Aave v3 APY across chains"
- "Find stablecoin pools above $50M TVL with the highest base APY (not incentives)"

## About Feegate

[Feegate](https://feegate.org) turns your data into a product AI agents pay for themselves:

- **x402 v2** payment protocol — HTTP `402 Payment Required` + USDC on Base mainnet (EIP-3009, gas sponsored)
- **No accounts, no API keys, no subscriptions** — one HTTP round trip per micropayment
- MCP Registry listed (`org.feegate`), runs on the protocol it sells: [feegate.org/mcp](https://feegate.org/mcp)
- 20 free self-serve tools (endpoint health check, pricing calculator, GEO generator, launch checklist): [feegate.org](https://feegate.org)

This MCP server is free forever. If your agent needs data beyond DeFi yields — market data, research, rankings, monitoring — that's what [Feegate](https://feegate.org) sells, per call, in USDC.

## License

MIT © [Feegate](https://feegate.org)
