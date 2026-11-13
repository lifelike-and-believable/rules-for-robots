#!/usr/bin/env node
// Start a delivery when a merge leaves one open (docs/specs/delivery-run.md, AC-16). Runs in the
// project's CI after each push to the default branch (templates/workflows/rfr-deliver.yml in the
// rfr-process plugin). It lists the open deliveries with `delivery open`, which costs no tokens, and
// only when there is one does it start the project's delivery routine, by one request to the
// routines API. It starts the first listed; that delivery's own merge runs this again for the next.
// Usage: node checks/ci/deliver-on-merge.mjs [project root]
// Environment: RFR_DELIVER_ROUTINE (the routine's id, trig_...) and RFR_DELIVER_TOKEN (its API
// trigger's token). The token is sent only to the API host below and never printed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDeliveries } from '../../plugins/process/scripts/delivery.mjs';

// A constant: the request's host never comes from input.
const API = 'https://api.anthropic.com';
const API_VERSION = '2026-10-21';
const ROUTINE_ID = /^trig_[A-Za-z0-9]+$/;
const TIMEOUT_MS = 30_000;

export const SETUP_STEPS = [
  "In Claude Code, create a routine on this repository whose prompt is /rfr-process:deliver with no feature name, with a cloud environment that can run the project's checks and no connectors the delivery does not need.",
  "In the routine's Edit dialog, add an API trigger and generate its token. The token is shown once.",
  "Store the routine's id (it starts with trig_) as the repository variable RFR_DELIVER_ROUTINE, and the token as the repository secret RFR_DELIVER_TOKEN.",
];

// A feature as `delivery open` prints it.
const describe = f => `${f.stories.join(', ')}${f.docs.length ? ` (user documentation: ${f.docs.join(', ')})` : ''}`;

// Removes the token, and any eight characters in a row of it, from text that may have come from
// elsewhere (an error message, a response body).
function redactor(token) {
  if (!token) return text => String(text);
  const parts = [token];
  for (let i = 0; i + 8 <= token.length; i++) parts.push(token.slice(i, i + 8));
  return text => {
    let out = String(text);
    for (let changed = true; changed;) {
      changed = false;
      for (const part of parts) {
        if (out.includes(part)) { out = out.split(part).join('[redacted]'); changed = true; }
      }
    }
    return out;
  };
}

function refusal(status, retryAfter, body) {
  const head = `The routines API refused the request to start a delivery (HTTP ${status}). No delivery was started.`;
  if (status === 401 || status === 403) return [head, "The token is wrong or has been revoked. Generate a new one in the routine's Edit dialog (its API trigger), store it as the repository secret RFR_DELIVER_TOKEN, and re-run this job."];
  if (status === 404) return [head, 'There is no such routine. Check that the repository variable RFR_DELIVER_ROUTINE holds the id shown with the routine\'s API trigger, and re-run this job.'];
  if (status === 429) {
    const wait = retryAfter && /^[\w ,:+-]{1,64}$/.test(retryAfter) ? ` The API asks to wait before trying again (Retry-After: ${retryAfter}).` : '';
    return [head, `The hourly limit for starting routines was reached.${wait} The next merge, or a re-run of this job, starts it.`];
  }
  return [head, `Response: ${body.slice(0, 300)}`, 'Re-run this job once the API answers again; the next merge also starts it.'];
}

// What to do for the open deliveries. Returns { code, lines, summary }: the exit code, the lines to
// print, and a line for the GitHub step summary (or null). Never throws.
export async function deliverOnMerge({ open, routine, token, fetch }) {
  const redact = redactor(token);
  const finish = (code, lines, summary = null) => ({ code, lines: lines.map(redact), summary: summary === null ? null : redact(summary) });
  if (!open.length) return finish(0, ['No delivery is open after this merge, so none was started.']);
  const listed = [`Open deliveries: ${open.length}.`, ...open.map(f => `- ${describe(f)}`)];
  if (!routine || !token) {
    const missing = [!routine && 'the repository variable RFR_DELIVER_ROUTINE', !token && 'the repository secret RFR_DELIVER_TOKEN'].filter(Boolean).join(' and ');
    return finish(0, [...listed, `No delivery was started: ${missing} ${!routine && !token ? 'are' : 'is'} not set. To start deliveries after each merge:`, ...SETUP_STEPS.map((s, i) => `${i + 1}. ${s}`)]);
  }
  // The id goes into the request's path, so anything but a routine id is refused. The value is not
  // printed: a token stored in the wrong place would otherwise appear in the log.
  if (!ROUTINE_ID.test(routine)) {
    return finish(1, ['RFR_DELIVER_ROUTINE should hold the routine\'s id: trig_ followed by letters and digits, as shown with the routine\'s API trigger. Its value is not that, so no delivery was started. Correct the repository variable and re-run this job.']);
  }
  const first = open[0];
  const text = `Deliver the open feature ${describe(first)}.`;
  let response;
  try {
    response = await fetch(`${API}/v1/claude_code/routines/${routine}/fire`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'anthropic-version': API_VERSION, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    return finish(1, [`Could not reach the routines API to start a delivery: ${e?.message ?? e}. No delivery was started; re-run this job, or the next merge starts it.`]);
  }
  let body = '';
  try { body = await response.text(); } catch { /* no body */ }
  if (!response.ok) return finish(1, refusal(response.status, response.headers.get('retry-after'), body));
  let session = null;
  try { session = JSON.parse(body)?.claude_code_session_url ?? null; } catch { /* not JSON */ }
  const where = typeof session === 'string' && session ? session : 'the response gave no session address';
  const lines = [`Started a delivery of ${describe(first)}: ${where}`];
  if (open.length > 1) {
    const rest = open.length - 1;
    lines.push(`${rest} more ${rest === 1 ? 'delivery waits' : 'deliveries wait'}; each delivery's merge starts the next.`);
  }
  return finish(0, lines, `Started a delivery of ${describe(first)}: ${where}`);
}

export async function main(argv, { env = process.env, fetch = globalThis.fetch, list = openDeliveries, log = console.log, error = console.error } = {}) {
  const root = path.resolve(argv[0] ?? '.');
  const result = await deliverOnMerge({ open: list(root), routine: env.RFR_DELIVER_ROUTINE?.trim(), token: env.RFR_DELIVER_TOKEN?.trim(), fetch });
  for (const line of result.lines) (result.code === 0 ? log : error)(line);
  if (result.summary && env.GITHUB_STEP_SUMMARY) {
    try { fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${result.summary}\n`); } catch { /* the summary is optional */ }
  }
  return result.code;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; });
}
