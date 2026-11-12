// For each pair of hook decisions, makes a scratch project whose settings register two PreToolUse
// hooks on Bash, runs `claude -p` once asking for one harmless command, and reports whether the
// command ran and what Claude Code said about the permission. Usage: node run.mjs <outfile>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLAUDE = process.env.CLAUDE_BIN || 'claude';
const decide = path.join(here, 'decide.mjs').replace(/\\/g, '/');
const MODE = process.env.MODE || 'default';
const pairs = MODE === 'default' ? [['allow', 'none'], ['none', 'none'], ['allow', 'ask'], ['ask', 'allow'], ['allow', 'deny'], ['ask', 'none']] : [['allow', 'none'], ['allow', 'ask'], ['allow', 'deny']];
const results = [];
for (const [a, b] of pairs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `rfr-hookcheck-${a}-${b}-`));
  fs.mkdirSync(path.join(dir, '.claude'));
  const hook = d => ({ type: 'command', command: `node "${decide}" ${d}` });
  fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), JSON.stringify({ hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [hook(a), hook(b)] }] } }, null, 2));
  const marker = path.join(dir, 'ran.txt').replace(/\\/g, '/');
  const prompt = `Run exactly this one shell command with the Bash tool, then stop: node -e "require('fs').writeFileSync('${marker}','ran')"`;
  const r = spawnSync(CLAUDE, ['-p', prompt, '--model', 'claude-haiku-5-5', '--output-format', 'json', '--max-turns', '3', '--permission-mode', MODE], { cwd: dir, encoding: 'utf8', timeout: 180000 });
  let out = {};
  try { out = JSON.parse(r.stdout); } catch { out = { raw: (r.stdout || r.stderr || '').slice(0, 400) }; }
  results.push({ hooks: `${a} + ${b}`, ran: fs.existsSync(path.join(dir, 'ran.txt')), denials: out.permission_denials ?? null, cost: out.total_cost_usd ?? null, result: String(out.result ?? out.raw ?? '').slice(0, 300) });
}
fs.writeFileSync(process.argv[2], JSON.stringify({ claudeCode: spawnSync(CLAUDE, ['--version'], { encoding: 'utf8' }).stdout.trim(), results }, null, 2));
console.log(JSON.stringify(results.map(r => ({ hooks: r.hooks, ran: r.ran, denied: r.denials?.length ?? null, cost: r.cost })), null, 1));
