// Tests for rfr-web's guard-cli hook: the Vercel CLI and database commands it refuses, moved from
// rfr-core's guard-commands in rewrite plan 25e (verify inventory slice f2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { decideWebCommand } from '../scripts/guard-cli.mjs';
import { decideCommand } from '../../core/scripts/guard-commands.mjs';

const refused = command => decideWebCommand(command)?.decision === 'ask';

test('database commands that skip a reviewed migration are refused (PG-001); generating and deploying migrations are not', () => {
  for (const command of ['npx drizzle-kit push', 'npx drizzle-kit migrate --force', 'npx prisma migrate dev', 'npx prisma migrate reset', 'npx prisma db push', 'npx prisma db migrate', "bash -c 'npx prisma db push'"]) {
    assert.ok(refused(command), command);
    assert.match(decideWebCommand(command).reason, /^rfr-web \(PG-001\): /, command);
  }
  for (const command of ['npx prisma migrate deploy', 'npx drizzle-kit generate', 'npx drizzle-kit migrate', 'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma',"python3 - <<'EOF'\nprint('never run npx drizzle-kit push')\nEOF"]) {
    assert.equal(decideWebCommand(command), null, command);
  }
});

test('Vercel production deploys, live-account changes, deletes, and secret pulls are refused by every route', () => {
  for (const command of [
    'vercel --prod', 'npx vercel deploy --prod', 'vercel --prod=true', 'vercel deploy --target=production', 'vercel deploy --target production', 'vercel promote dpl_1', 'vercel alias set a b', 'vercel domains add x.com', 'vercel rollback',
    'vercel redeploy https://app.vercel.app', 'vercel env add SECRET production', 'vercel env rm SECRET production -y',
    'vercel remove app --yes', 'vercel rm app', 'vercel project rm app', 'vercel dns rm rec_1', 'vercel certs rm cert_1',
    'vercel env pull .env.local', 'vercel pull --environment=production',
    'npx --yes vercel remove app', 'npx vercel@latest remove app', 'pnpm exec vercel remove app', 'vercel --scope acme remove app', 'vercel --token t env rm X production', 'vercel --cwd app env pull',
    'vercel.exe --prod', "bash -c 'vercel --prod'", 'echo "$(vercel env pull)"', 'cd app && vercel --prod',
  ]) assert.ok(refused(command), command);
  for (const command of ['vercel', 'vercel deploy', 'npx vercel deploy', 'vercel --prod=false', 'vercel redeploy https://x --target preview', 'vercel env ls', 'vercel ls', 'vercel logs dpl_1', 'git status', 'echo vercel --prod']) {
    assert.equal(decideWebCommand(command), null, command);
  }
});

test('each refusal names the rule, the action, why, and what to do instead', () => {
  const shape = /^rfr-web \((PG-001|NODE-002|WA-003|SEC-001)\): .+\. .+\. If not approved: .+\.$/s;
  for (const [command, rule] of [['vercel --prod', 'NODE-002'], ['vercel rm app', 'WA-003'], ['vercel env pull', 'SEC-001'], ['npx prisma db push', 'PG-001']]) {
    const { reason } = decideWebCommand(command);
    assert.match(reason, shape, command);
    assert.match(reason, new RegExp(`\\(${rule}\\)`), command);
  }
  assert.match(decideWebCommand('vercel --prod').reason, /deploy a preview and report its URL/);
});

test('rfr-core no longer decides the Vercel CLI and database cases; rfr-web does', () => {
  for (const command of ['vercel --prod', 'vercel env pull', 'vercel rm app', 'npx drizzle-kit push', 'npx prisma migrate reset']) {
    assert.equal(decideCommand(command), null, `rfr-core: ${command}`);
    assert.ok(refused(command), `rfr-web: ${command}`);
  }
});

test('hooks.json runs guard-cli for Bash and PowerShell, and the hook refuses through Claude Code', () => {
  const hooks = JSON.parse(fs.readFileSync('plugins/web/hooks/hooks.json', 'utf8')).hooks.PreToolUse;
  const entry = hooks.find(h => h.hooks.some(x => /guard-cli\.mjs/.test(x.command)));
  assert.ok(entry, 'guard-cli entry');
  assert.equal(entry.matcher, 'Bash|PowerShell');
  const run = command => spawnSync(process.execPath, ['plugins/web/scripts/guard-cli.mjs'], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: process.cwd() }), encoding: 'utf8', env: { ...process.env, RFR_GUARD_LOG: '0' } });
  const out = JSON.parse(run('vercel --prod').stdout);
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /NODE-002/);
  assert.equal(run('vercel deploy').stdout, '');
});
