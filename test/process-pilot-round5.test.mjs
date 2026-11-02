// Tests for the fifth round of fixes from the Kettlebird pilot (docs/specs/project-process.md,
// "Pilot findings: round 5"). Each test title cites the criterion it covers (project-process#AC-n).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { relink } from '../checks/process-relink.mjs';
import { runProcessTrace } from '../checks/process-trace.mjs';
import { runTutorial } from '../checks/tutorial-run.mjs';
import { annotation } from '../checks/ci/mutation-summary.mjs';

// ---- AC-35: stale links in drafts ---------------------------------------------------------------

function project(designStatus) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-round5-'));
  const files = {
    'docs/product/process.yml': 'default: [lead]\n',
    'docs/product/concept.md': '---\nid: concept\nstatus: approved\n---\n\n# Concept\n\n## Audience\n\nFans.\n',
    'docs/product/personas/fan.md': '---\nid: persona-fan\nstatus: approved\nderived-from:\n  - concept#audience:\n---\n\n# Fan\n\n## Goals\n\nRead.\n',
    'docs/product/epics/read.md': '---\nid: epic-read\nstatus: approved\nderived-from:\n  - persona-fan#goals:\n---\n\n# Reading\n\n## Outcome\n\nFans read.\n',
    'docs/product/stories/read/first.md': '---\nid: story-first\nstatus: approved\nderived-from:\n  - epic-read#outcome:\n  - persona-fan#goals:\n---\n\n# First\n\nAs a fan, I want to read so that I enjoy it.\n\n## Acceptance criteria\n\n- Pages show.\n',
    'docs/design/reader.md': `---\nid: design-reader\nstatus: ${designStatus}\nderived-from:\n  - story-first:\n---\n\n# Reader\n\nA page.\n`,
  };
  for (const [f, t] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), t); }
  relink(root, ['persona-fan', 'epic-read', 'story-first']);
  return root;
}

test('project-process#AC-35: a draft whose recorded hash is out of date gets a warning, not an error', () => {
  const root = project('draft');
  relink(root, ['design-reader']);
  const story = path.join(root, 'docs/product/stories/read/first.md');
  fs.writeFileSync(story, fs.readFileSync(story, 'utf8').replace('- Pages show.', '- Pages show in order.'));
  relink(root, ['story-first']);
  const r = runProcessTrace(root);
  assert.deepEqual(r.errors, []);
  assert.match(r.warnings.join('\n'), /design-reader.*story-first.*changed since it was recorded/);
});

test('project-process#AC-35: a draft with no recorded hash gets no stale warning', () => {
  const r = runProcessTrace(project('draft'));
  assert.doesNotMatch(r.warnings.join('\n'), /design-reader.*changed since/);
});

// ---- AC-36: protected previews --------------------------------------------------------------------

let locked;
let redirecting;
let login;
before(async () => {
  login = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<title>Log in</title><h1>Log in to Vercel</h1>'); });
  await new Promise(r => login.listen(0, '127.0.0.1', r));
  const loginUrl = `http://localhost:${login.address().port}/login`;
  locked = http.createServer((req, res) => { res.writeHead(401, { 'content-type': 'text/html' }); res.end('<h1>Authentication required</h1>'); });
  await new Promise(r => locked.listen(0, '127.0.0.1', r));
  redirecting = http.createServer((req, res) => { res.writeHead(302, { location: loginUrl }); res.end(); });
  await new Promise(r => redirecting.listen(0, '127.0.0.1', r));
});
after(() => { locked?.close(); redirecting?.close(); login?.close(); });

const TUTORIAL = '---\nid: tutorial-home\nstatus: draft\nrunner: web\n---\n\n# Tutorial\n\n## Steps\n\n1. Open `/`. You see **Comics**.\n';

test('project-process#AC-36: a 401 is reported as a protected deployment, naming the bypass setting', async () => {
  const r = await runTutorial({ text: TUTORIAL, baseUrl: `http://127.0.0.1:${locked.address().port}`, timeout: 1500 });
  assert.equal(r.ok, false);
  assert.match(r.failure.message, /protected/);
  assert.match(r.failure.message, /RFR_PREVIEW_BYPASS|RFR_TUTORIAL_HEADER/);
});

test('project-process#AC-36: landing on another origin is reported as a protected deployment', async () => {
  const r = await runTutorial({ text: TUTORIAL, baseUrl: `http://127.0.0.1:${redirecting.address().port}`, timeout: 1500 });
  assert.equal(r.ok, false);
  assert.match(r.failure.message, /protected/);
  assert.match(r.failure.message, /localhost:\d+/, 'names where it landed');
});

// ---- AC-37: mutation score as an annotation ------------------------------------------------------

test('project-process#AC-37: the summary script prints the score as a notice annotation', () => {
  const line = annotation({ score: 87.5, total: 40, killed: 33, timeout: 2, survived: 4, noCoverage: 1, survivors: [] });
  assert.match(line, /^::notice title=Mutation score::87\.5%/);
  assert.match(line, /5 undetected/);
});

test('project-process#AC-37: the mutation job asks for the annotation', () => {
  const job = YAML.parse(fs.readFileSync('.github/workflows/rfr-process.yml', 'utf8')).jobs.mutation;
  assert.match(job.steps.map(s => s.run ?? '').join('\n'), /mutation-summary\.mjs .*--annotate/);
});
