#!/usr/bin/env node
// Start a delivery when a merge leaves one open (docs/specs/delivery-run.md, AC-16). Runs in the
// project's CI after each push to the default branch (templates/workflows/rfr-deliver.yml in the
// rfr-process plugin). It lists the open deliveries with `delivery open`, which costs no tokens, and
// only when there is one does it start the project's delivery routine, by one request to the
// routines API. It starts the first listed; that delivery's own merge runs this again for the next.
// Usage: node checks/ci/deliver-on-merge.mjs [project root] [--marker <file>]
// Environment: RFR_DELIVER_ROUTINE (the routine's id, trig_...) and RFR_DELIVER_TOKEN (its API
// trigger's token). The token is sent only to the API host below and never printed.
// The marker file records the last delivery started, so that a second merge soon after does not
// start the same one again (see MARKER_MINUTES). The workflow keeps it between runs in the cache.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDeliveries } from '../../plugins/process/scripts/delivery.mjs';

// A constant: the request's host never comes from input.
const API = 'https://api.anthropic.com';
const API_VERSION = '2026-10-21';
const ROUTINE_ID = /^trig_[A-Za-z0-9]+$/;
// RFR_DELIVER_ROUTINE holds the routine's address as its page gives it to copy
// (https://api.anthropic.com/v1/claude_code/routines/trig_.../fire) or the bare id. Only the id is
// taken from it, and only from an address of exactly that shape on that host: the request is always
// built from the constant host below, so no value can send the token anywhere else.
const ROUTINE_ADDRESS = /^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/(trig_[A-Za-z0-9]+)(?:\/fire)?\/?$/;
export function routineIdOf(value) {
  const text = String(value ?? '').trim();
  if (ROUTINE_ID.test(text)) return text;
  return ROUTINE_ADDRESS.exec(text)?.[1] ?? null;
}
const TIMEOUT_MS = 30_000;
// Ids from front matter can be any single-line text; only these are sent or printed.
const PLAIN_ID = /^[A-Za-z0-9._-]{1,100}$/;
// A delivery shows as under way once its session pushes the spec, a few minutes after it starts.
// Until then `delivery open` still lists it, so a run within this many minutes of starting a
// feature's delivery starts no other for that feature. 45 minutes leaves a wide margin.
export const MARKER_MINUTES = 45;

export const SETUP_STEPS = [
  "In Claude Code, create a routine on this repository whose prompt is /rfr-process:deliver with no feature name, with a cloud environment that can run the project's checks and no connectors the delivery does not need.",
  "In the routine's Edit dialog, add an API trigger and generate its token. The token is shown once.",
  "In the repository's settings, create an environment named rfr-deliver, limit its deployment branches to the default branch, and store two secrets there: the routine's address, copied from its API trigger, as the environment secret RFR_DELIVER_ROUTINE, and its token as the environment secret RFR_DELIVER_TOKEN, so that only a run on the default branch can read them.",
];

const TOKEN_REFUSED = "RFR_DELIVER_TOKEN does not look like a routine's token; generate one in the routine's Edit dialog and store it as the environment secret.";

const plain = ids => ids.filter(id => typeof id === 'string' && PLAIN_ID.test(id));

// A feature as `delivery open` prints it, with only plain ids, and a count of any left out.
function describe(f) {
  const stories = plain(f.stories);
  const docs = plain(f.docs);
  const left = f.stories.length + f.docs.length - stories.length - docs.length;
  const named = stories.length ? stories.join(', ') : 'a feature with no plain story id';
  const userDocs = docs.length ? ` (user documentation: ${docs.join(', ')})` : '';
  const leftOut = left ? ` (and ${left} ${left === 1 ? 'id left out because it is not a plain id' : 'ids left out because they are not plain ids'})` : '';
  return `${named}${userDocs}${leftOut}`;
}

// Removes the token, and any eight characters in a row of it, from text that may have come from
// elsewhere (an error message, a response body), in one pass, longest match first.
export function redactor(token) {
  if (!token) return text => String(text);
  const parts = new Set([token]);
  for (let i = 0; i + 8 <= token.length; i++) parts.add(token.slice(i, i + 8));
  const escape = s => s.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
  const pattern = new RegExp([...parts].sort((a, b) => b.length - a.length).map(escape).join('|'), 'g');
  return text => String(text).replace(pattern, '[redacted]');
}

// A session address that is safe to print: https, no spaces, not too long.
const address = value => (typeof value === 'string' && /^https:\/\/\S{1,300}$/.test(value) ? value : null);

// The marker's start time when it names this feature and is within the window, else null.
function recentStart(last, feature, now) {
  let marker;
  try { marker = JSON.parse(last); } catch { return null; }
  if (!marker || typeof marker !== 'object' || !Array.isArray(marker.feature)) return null;
  if (JSON.stringify([...marker.feature].sort()) !== JSON.stringify(feature)) return null;
  const started = Date.parse(marker.startedAt);
  const age = now - started;
  if (!Number.isFinite(age) || age < 0 || age >= MARKER_MINUTES * 60_000) return null;
  return { minutes: Math.floor(age / 60_000), session: address(marker.session) };
}

function refusal(status, retryAfter, body) {
  const head = `The routines API refused the request to start a delivery (HTTP ${status}). No delivery was started.`;
  if (status === 401 || status === 403) return [head, "The token is wrong or has been revoked. Generate a new one in the routine's Edit dialog (its API trigger), store it as the environment secret RFR_DELIVER_TOKEN in the rfr-deliver environment, and re-run this job."];
  if (status === 404) return [head, 'There is no such routine. Check that the environment secret RFR_DELIVER_ROUTINE holds the address or id shown with the routine\'s API trigger, and re-run this job.'];
  if (status === 429) {
    const wait = retryAfter && /^[\w ,:+-]{1,64}$/.test(retryAfter) ? ` The API asks to wait before trying again (Retry-After: ${retryAfter}).` : '';
    return [head, `The hourly limit for starting routines was reached.${wait} The next merge, or a re-run of this job, starts it.`];
  }
  return [head, `Response: ${body.slice(0, 300)}`, 'Re-run this job once the API answers again; the next merge also starts it.'];
}

// What to do for the open deliveries. `last` is the marker file's text, or null; `now` is the time
// in milliseconds. Returns { code, lines, summary, marker }: the exit code, the lines to print, a
// line for the GitHub step summary (or null), and the marker to write (or null). Never throws.
export async function deliverOnMerge({ open, routine, token, fetch, last = null, now = Date.now() }) {
  // A token this short, or with spaces, is a mistake (and would make the redaction below blank
  // ordinary words), so it is refused before anything else, without printing any of it.
  if (token && (token.length < 20 || /\s/.test(token))) return { code: 1, lines: [TOKEN_REFUSED], summary: null, marker: null };
  const redact = redactor(token);
  const finish = (code, lines, summary = null, marker = null) => ({ code, lines: lines.map(redact), summary: summary === null ? null : redact(summary), marker });
  if (!open.length) return finish(0, ['No delivery is open after this merge, so none was started.']);
  const listed = [`Open deliveries: ${open.length}.`, ...open.map(f => `- ${describe(f)}`)];
  if (!routine || !token) {
    const missing = [!routine && 'the environment secret RFR_DELIVER_ROUTINE', !token && 'the environment secret RFR_DELIVER_TOKEN'].filter(Boolean).join(' and ');
    return finish(0, [...listed, `No delivery was started: ${missing} ${!routine && !token ? 'are' : 'is'} not set. To start deliveries after each merge:`, ...SETUP_STEPS.map((s, i) => `${i + 1}. ${s}`)]);
  }
  // The id goes into the request's path, so anything but a routine id is refused. The value is not
  // printed: a token stored in the wrong place would otherwise appear in the log.
  const id = routineIdOf(routine);
  if (!id) {
    return finish(1, ['RFR_DELIVER_ROUTINE should hold the routine\'s address as copied from its API trigger (https://api.anthropic.com/v1/claude_code/routines/trig_.../fire), or its id: trig_ followed by letters and digits. Its value is not that, so no delivery was started. Correct the environment secret and re-run this job.']);
  }
  const first = open[0];
  const feature = plain(first.stories).sort();
  if (!feature.length) {
    return finish(1, ["The first open delivery's story ids cannot be named safely: none is a plain id (letters, digits, dots, hyphens, and underscores, up to 100 characters). No delivery was started. Give the story a plain id in its front matter and merge that change."]);
  }
  const recent = last === null ? null : recentStart(last, feature, now);
  if (recent) {
    return finish(0, [`A delivery of ${describe(first)} was started ${recent.minutes} minutes ago (${recent.session ?? 'no session address'}), so this merge starts no other.`]);
  }
  const text = `Deliver the open feature ${describe(first)}.`;
  let response;
  try {
    response = await fetch(`${API}/v1/claude_code/routines/${id}/fire`, {
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
  try { session = address(JSON.parse(body)?.claude_code_session_url); } catch { /* not JSON */ }
  session = session === null ? null : redact(session);
  const where = session ?? 'the response gave no session address';
  const lines = [`Started a delivery of ${describe(first)}: ${where}`];
  if (open.length > 1) {
    const rest = open.length - 1;
    lines.push(`${rest} more ${rest === 1 ? 'delivery waits' : 'deliveries wait'}; each delivery's merge starts the next.`);
  }
  return finish(0, lines, `Started a delivery of ${describe(first)}: ${where}`, { feature, startedAt: new Date(now).toISOString(), session });
}

export async function main(argv, { env = process.env, fetch = globalThis.fetch, list = openDeliveries, log = console.log, error = console.error, now = Date.now() } = {}) {
  const at = argv.indexOf('--marker');
  const markerFile = at === -1 ? null : argv[at + 1] ?? null;
  const root = path.resolve(argv.find((a, i) => !a.startsWith('--') && (at === -1 || i !== at + 1)) ?? '.');
  let last = null;
  if (markerFile) { try { last = fs.readFileSync(markerFile, 'utf8'); } catch { /* no marker yet */ } }
  const result = await deliverOnMerge({ open: list(root), routine: env.RFR_DELIVER_ROUTINE?.trim(), token: env.RFR_DELIVER_TOKEN?.trim(), fetch, last, now });
  for (const line of result.lines) (result.code === 0 ? log : error)(line);
  if (result.summary && env.GITHUB_STEP_SUMMARY) {
    try { fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${result.summary}\n`); } catch { /* the summary is optional */ }
  }
  if (result.marker && markerFile) {
    try {
      fs.mkdirSync(path.dirname(markerFile), { recursive: true });
      fs.writeFileSync(markerFile, `${JSON.stringify(result.marker)}\n`);
    } catch {
      log(`Could not record this start in ${markerFile}, so a merge in the next ${MARKER_MINUTES} minutes may start the same delivery again.`);
    }
  }
  return result.code;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; });
}
