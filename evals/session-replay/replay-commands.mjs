#!/usr/bin/env node
// Replays the shell commands of real sessions through guard-commands and rfr-web's guard-cli, as a
// web project runs them (docs/specs/unattended.md, AC-7; guard-cli since rewrite plan 25e, f2)
// and reports every one that is not simply allowed, so a person can check that only actions on the
// never list are refused. Snapshots are stubbed, so nothing is written; the commands are not run.
//
// Sources: a Claude Code transcript (.jsonl) or a saved page of a remote session's events (the JSON
// that list_events returns, saved to a file). Commands run where the session ran them when that folder
// exists here, and otherwise in --cwd (default: this repository).
//
// A session from another machine names its own paths: --map <from>=<to> (repeatable) rewrites them in
// each command, such as a cloud session's /home/user/<repo> to the local clone, and /var/tmp to a
// local temp folder.
//
// Usage: node evals/session-replay/replay-commands.mjs <source>... [--cwd <dir>] [--map <from>=<to>]... [--json]
import fs from 'node:fs';
import path from 'node:path';
import { decideCommand } from '../../plugins/core/scripts/guard-commands.mjs';
import { decideWebCommand } from '../../plugins/web/scripts/guard-cli.mjs';

function commandsIn(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const out = [];
  const take = (block, cwd) => {
    if (block?.type === 'tool_use' && /^(Bash|PowerShell)$/.test(block.name) && typeof block.input?.command === 'string') out.push({ command: block.input.command, cwd });
  };
  if (file.endsWith('.jsonl')) {
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      let e;
      try { e = JSON.parse(line); } catch { continue; }
      if (e.type === 'assistant' && Array.isArray(e.message?.content)) for (const b of e.message.content) take(b, e.cwd);
    }
    return out;
  }
  const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  for (const e of json.ccr?.data ?? json.data ?? []) {
    const content = e.assistant?.internal_anthropic_catchall?.message?.content;
    if (Array.isArray(content)) for (const b of content) take(b, null);
  }
  return out;
}

const args = process.argv.slice(2);
const cwdAt = args.indexOf('--cwd');
const fallback = path.resolve(cwdAt >= 0 ? args[cwdAt + 1] : '.');
const files = args.filter((a, k) => !a.startsWith('--') && args[k - 1] !== '--cwd' && args[k - 1] !== '--map');
const maps = args.flatMap((a, k) => (a === '--map' ? [args[k + 1].split('=')] : []));
const mapped = command => maps.reduce((c, [from, to]) => c.split(from).join(to.replace(/\\/g, '/')), command);
const noSnapshot = () => ({ refs: [], lines: ['(snapshot stubbed)'] });
const counts = {};
const notable = [];
let total = 0;
for (const file of files) {
  for (const { command, cwd } of commandsIn(file)) {
    total++;
    const where = cwd && fs.existsSync(cwd) ? cwd : fallback;
    let d;
    try {
      d = decideCommand(mapped(command), { cwd: where, snapshot: noSnapshot });
      // The strictest decision stands, as when Claude Code runs both hooks.
      if (d?.decision !== 'ask' && d?.decision !== 'deny') d = decideWebCommand(mapped(command), { cwd: where }) ?? d;
    } catch (e) {
      d = { decision: 'error', reason: e.message };
    }
    const kind = d?.decision ?? 'allow';
    counts[kind] = (counts[kind] ?? 0) + 1;
    if (kind === 'ask' || kind === 'deny' || kind === 'error') notable.push({ kind: kind === 'ask' ? 'never' : kind, command: command.replace(/\s+/g, ' ').slice(0, 200), reason: String(d.reason ?? '').split('. ')[0].slice(0, 160) });
  }
}
if (args.includes('--json')) console.log(JSON.stringify({ total, counts, notable }, null, 2));
else {
  console.log(`${total} commands: ${Object.entries(counts).map(([k, v]) => `${v} ${k === 'ask' ? 'never (refused, nobody asked)' : k}`).join(', ')}`);
  for (const n of notable) console.log(`- [${n.kind}] ${n.command}\n    ${n.reason}`);
}
