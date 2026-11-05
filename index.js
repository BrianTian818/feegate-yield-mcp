#!/usr/bin/env node
/**
 * feegate-yield-mcp — Free open-source MCP server for DeFi yield data.
 *
 * Data source: DefiLlama public yields API (https://yields.llama.fi/pools).
 * No API key. No account. No dependencies — plain Node.js >= 18.
 *
 * Brought to you by Feegate — the x402 data marketplace for AI agents.
 *   https://feegate.org  ·  https://feegate.org/mcp (paid marketplace, USDC per call)
 *
 * License: MIT
 */
'use strict';

const POOLS_URL = 'https://yields.llama.fi/pools';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const UA = 'feegate-yield-mcp/1.0 (+https://feegate.org)';

let poolsCache = null;
let poolsCacheAt = 0;

async function fetchPools() {
  if (poolsCache && Date.now() - poolsCacheAt < CACHE_TTL_MS) return poolsCache;
  const res = await fetch(POOLS_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('upstream ' + res.status + ' from ' + POOLS_URL);
  const json = await res.json();
  poolsCache = Array.isArray(json.data) ? json.data : [];
  poolsCacheAt = Date.now();
  return poolsCache;
}

function fmtPool(p) {
  const o = {
    chain: p.chain,
    project: p.project,
    symbol: p.symbol,
    tvl_usd: p.tvlUsd,
    apy_total: p.apy,
  };
  if (p.apyBase != null) o.apy_base = p.apyBase;
  if (p.apyReward != null) o.apy_reward = p.apyReward;
  if (p.stablecoin != null) o.stablecoin = p.stablecoin;
  if (p.ilRisk != null) o.il_risk = p.ilRisk;
  if (p.apyMean30d != null) o.apy_mean_30d = p.apyMean30d;
  return o;
}

// ---------- tools ----------

const TOOLS = [
  {
    name: 'list_chains',
    description:
      'List all chains that have DeFi yield pools, with pool counts and total TVL. ' +
      'Use this first to discover which chains are available before calling get_pools.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_pools',
    description:
      'Get top DeFi yield pools ranked by TVL, filtered by chain. ' +
      'Returns APY (total / base / reward), TVL, stablecoin flag and IL risk for each pool. ' +
      'Data: DefiLlama, updated continuously, cached 5 min. Free, no API key.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: { type: 'string', description: 'Chain name (case-insensitive), e.g. "Ethereum", "Base", "Solana". Omit to search all chains.' },
        limit: { type: 'integer', description: 'Max pools to return (1-50, default 10).' },
        min_tvl: { type: 'number', description: 'Minimum TVL in USD (default 1000000 = $1M).' },
        stablecoin_only: { type: 'boolean', description: 'If true, only return stablecoin pools (lower risk).' },
      },
    },
  },
  {
    name: 'get_project_yields',
    description:
      'Get all yield pools of one DeFi project/protocol (e.g. "aave-v3", "curve-dex"), ' +
      'across all chains, ranked by TVL.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project slug as used by DefiLlama, e.g. "aave-v3".' },
        limit: { type: 'integer', description: 'Max pools to return (1-50, default 15).' },
      },
      required: ['project'],
    },
  },
];

async function callTool(name, args) {
  const a = args || {};
  if (name === 'list_chains') {
    const pools = await fetchPools();
    const m = new Map();
    for (const p of pools) {
      if (!p.chain) continue;
      const r = m.get(p.chain) || { chain: p.chain, pools: 0, tvl_usd: 0 };
      r.pools += 1;
      r.tvl_usd += p.tvlUsd || 0;
      m.set(p.chain, r);
    }
    const rows = [...m.values()].sort((x, y) => y.tvl_usd - x.tvl_usd);
    return `${rows.length} chains with yield pools (ranked by total TVL):\n` +
      rows.map(r => `- ${r.chain}: ${r.pools} pools, TVL $${Math.round(r.tvl_usd).toLocaleString('en-US')}`).join('\n') +
      `\n\nNext: call get_pools with chain="<name>" or get_project_yields with project="<slug>".`;
  }
  if (name === 'get_pools') {
    const pools = await fetchPools();
    const limit = Math.min(Math.max(parseInt(a.limit) || 10, 1), 50);
    const minTvl = typeof a.min_tvl === 'number' ? a.min_tvl : 1000000;
    const chain = (a.chain || '').trim().toLowerCase();
    let rows = pools.filter(p =>
      (p.tvlUsd || 0) >= minTvl &&
      (!chain || (p.chain || '').toLowerCase() === chain) &&
      (!a.stablecoin_only || p.stablecoin)
    );
    rows.sort((x, y) => (y.tvlUsd || 0) - (x.tvlUsd || 0));
    rows = rows.slice(0, limit);
    if (!rows.length) return 'No pools matched. Call list_chains to see available chains, or lower min_tvl.';
    return JSON.stringify(rows.map(fmtPool), null, 1) +
      `\n(${rows.length} pools, chain=${chain || 'ALL'}, min_tvl=$${minTvl.toLocaleString('en-US')}` +
      `${a.stablecoin_only ? ', stablecoin_only' : ''}). ` +
      `Note: high APY often = low liquidity or unsustainable incentives. Check apy_base vs apy_reward.`;
  }
  if (name === 'get_project_yields') {
    const pools = await fetchPools();
    const proj = (a.project || '').trim().toLowerCase();
    const limit = Math.min(Math.max(parseInt(a.limit) || 15, 1), 50);
    let rows = pools.filter(p => (p.project || '').toLowerCase() === proj);
    rows.sort((x, y) => (y.tvlUsd || 0) - (x.tvlUsd || 0));
    rows = rows.slice(0, limit);
    if (!rows.length) {
      const hint = pools.filter(p => (p.project || '').toLowerCase().includes(proj)).slice(0, 8)
        .map(p => p.project);
      return 'No pools for project "' + a.project + '".' +
        (hint.length ? ' Similar slugs: ' + [...new Set(hint)].join(', ') : '');
    }
    return JSON.stringify(rows.map(fmtPool), null, 1);
  }
  throw new Error('unknown tool: ' + name);
}

// ---------- stdio JSON-RPC (MCP) ----------

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, terminal: false });

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = {
  name: 'feegate-yield-mcp',
  version: '1.0.0',
  vendor: 'Feegate',
  homepage: 'https://feegate.org',
};

rl.on('line', (line) => {
  line = line.trim();
  if (!line) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  if (method === 'initialize') {
    send({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: (params && params.protocolVersion) || PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions:
          'Free DeFi yield data (DefiLlama). Start with list_chains, then get_pools(chain, min_tvl, stablecoin_only) or get_project_yields(project). ' +
          'Brought to you by Feegate — the x402 marketplace where AI agents buy data per call in USDC: https://feegate.org',
      },
    });
  } else if (method === 'notifications/initialized') {
    // no response for notifications
  } else if (method === 'ping') {
    send({ jsonrpc: '2.0', id, result: {} });
  } else if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  } else if (method === 'tools/call') {
    const tname = params && params.name;
    const targs = (params && params.arguments) || {};
    Promise.resolve()
      .then(() => callTool(tname, targs))
      .then((text) => send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: String(text) }] } }))
      .catch((e) => send({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true },
      }));
  } else {
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + method } });
  }
});

process.stderr.write('[feegate-yield-mcp] ready on stdio — by Feegate (https://feegate.org)\n');
