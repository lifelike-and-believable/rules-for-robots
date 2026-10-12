// Shared parsing for specs under docs/specs/ (docs/specs/spec-test-traceability.md).
// Dependency-free, so the checks run on any runner without npm install.
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_TEST_DIRS = ['test', 'tests', 'spec', '__tests__'];
export const CITATION = /\b([a-z0-9][a-z0-9_-]*)#AC-(\d+)\b/g;

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

// Front matter fields: status, tests (inline list), tests-commit, and unlocks (a block list of
// "path: reason"). Lines starting with # are comments.
function parseFrontMatter(block) {
  const out = { status: null, testsCommit: null, testDirs: null, unlocks: [] };
  let inUnlocks = false;
  for (const raw of block.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const item = /^\s+-\s+(.+?):(?:\s+(.*))?$/.exec(raw);
    if (inUnlocks && item) {
      out.unlocks.push({ file: item[1].trim(), reason: (item[2] ?? '').trim() });
      continue;
    }
    const field = /^([a-z-]+):\s*(.*)$/.exec(raw);
    if (!field) continue;
    inUnlocks = false;
    const [, key, value] = field;
    if (key === 'status') out.status = value.trim() || null;
    else if (key === 'tests-commit') out.testsCommit = value.trim() || null;
    else if (key === 'tests') out.testDirs = value.replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean);
    else if (key === 'unlocks') inUnlocks = true;
  }
  return out;
}

function parseCriteria(body) {
  const section = /^## Acceptance criteria\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(body)?.[1] ?? '';
  const criteria = [];
  for (const row of section.split('\n').filter(l => l.trim().startsWith('|'))) {
    const cells = row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    if (!/^AC-\d+$/.test(cells[0] ?? '')) continue;
    const verifiedBy = cells[2] ?? '';
    criteria.push({ id: cells[0], text: cells[1] ?? '', verifiedBy, needsTest: /^test:/i.test(verifiedBy) });
  }
  return criteria;
}

export function parseSpec(text, slug) {
  const match = FRONT_MATTER.exec(text);
  if (!match) return { slug, status: null, testsCommit: null, testDirs: null, unlocks: [], criteria: [], errors: [`${slug}: no front matter (a --- block with at least "status:")`] };
  const front = parseFrontMatter(match[1]);
  const criteria = parseCriteria(match[2]);
  const errors = [];
  const seen = new Set();
  for (const c of criteria) {
    if (seen.has(c.id)) errors.push(`${slug}#${c.id} appears more than once`);
    seen.add(c.id);
  }
  return { slug, ...front, criteria, errors };
}

export function listSpecs(root, specsDir = 'docs/specs') {
  const dir = path.join(root, specsDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'README.md').sort()
    .map(f => parseSpec(fs.readFileSync(path.join(dir, f), 'utf8'), f.replace(/\.md$/, '')));
}

// Every "<slug>#AC-<n>" in the files under `dirs` (relative to root), as { file, slug, id }.
export function findCitations(root, dirs) {
  const found = [];
  const walk = (abs, rel) => {
    let entries;
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const childAbs = path.join(abs, e.name);
      const childRel = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(childAbs, childRel);
      else if (e.isFile() && fs.statSync(childAbs).size < 1_000_000) {
        const text = fs.readFileSync(childAbs, 'utf8');
        for (const m of text.matchAll(CITATION)) found.push({ file: childRel, slug: m[1], id: `AC-${m[2]}` });
      }
    }
  };
  for (const dir of dirs) {
    const abs = path.join(root, dir);
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) walk(abs, dir.replace(/\\/g, '/').replace(/\/$/, ''));
  }
  return found;
}
