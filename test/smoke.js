#!/usr/bin/env node
'use strict';
/**
 * Smoke test: pipe a JSON-RPC session through index.js and verify responses.
 * Usage: node test/smoke.js
 */
const { spawn } = require('child_process');
const path = require('path');

const child = spawn(process.execPath, [path.join(__dirname, '..', 'index.js')]);
let buf = '';
const results = [];

function send(obj) {
  child.stdin.write(JSON.stringify(obj) + '\n');
}

child.stdout.on('data', (d) => { buf += d.toString(); pump(); });
child.stderr.on('data', (d) => process.stderr.write('[server] ' + d));

const steps = [
  { req: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
    check: (r) => r.result && r.result.serverInfo && r.result.serverInfo.name === 'feegate-yield-mcp' },
  { req: { jsonrpc: '2.0', method: 'notifications/initialized' }, check: null },
  { req: { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    check: (r) => r.result && r.result.tools && r.result.tools.length === 3 },
  { req: { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_chains', arguments: {} } },
    check: (r) => r.result && /chains with yield pools/.test(r.result.content[0].text) },
  { req: { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'get_pools', arguments: { chain: 'Base', limit: 3, min_tvl: 10000000 } } },
    check: (r) => r.result && /"chain": "Base"/.test(r.result.content[0].text) && /apy_total/.test(r.result.content[0].text) },
  { req: { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'get_pools', arguments: { stablecoin_only: true, limit: 2, min_tvl: 50000000 } } },
    check: (r) => r.result && /"stablecoin": true/.test(r.result.content[0].text) },
  { req: { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'get_project_yields', arguments: { project: 'aave-v3', limit: 3 } } },
    check: (r) => r.result && /"project": "aave-v3"/.test(r.result.content[0].text) },
];

function pump() {
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    const step = steps.find(s => s.done !== true && s.check !== null);
    if (!step) continue;
    step.done = true;
    step.ok = step.check ? step.check(msg) : true;
    step.resp = msg;
    runNext();
  }
}

let cursor = 0;
function runNext() {
  while (cursor < steps.length && steps[cursor].done) {
    cursor++;
  }
  if (cursor >= steps.length) {
    finish();
    return;
  }
  const s = steps[cursor];
  if (s.check === null) {
    // notification: no response expected, mark done immediately
    s.done = true;
    cursor++;
    runNext();
    return;
  }
  send(s.req);
}

function finish() {
  const timeout = setTimeout(() => {
    console.error('TIMEOUT waiting for responses');
    child.kill();
    process.exit(1);
  }, 120000);
  // small settle for ordering
  setTimeout(() => {
    clearTimeout(timeout);
    child.kill();
    let pass = 0, fail = 0;
    for (const s of steps) {
      if (s.check === null) continue;
      if (s.ok) { pass++; console.log('PASS', s.req.method, s.req.params ? (s.req.params.name || '') : ''); }
      else { fail++; console.log('FAIL', s.req.method, JSON.stringify(s.resp).slice(0, 300)); }
    }
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }, 3000);
}

runNext();
