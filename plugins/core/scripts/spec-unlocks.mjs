// Whether a spec records an approved reason to change a test file (test-change-review AC-5): an
// entry for the file under the spec's `unlocks:` front matter whose reason cites a criterion ID the
// spec defines. The session hook only checks that such a reason is recorded; the pull request
// review checks the reason itself.
import fs from 'node:fs';
import path from 'node:path';

function frontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  return m ? m[1] : '';
}

// [{ file, reason }] from an `unlocks:` block list of "- path: reason" lines.
export function unlocksOf(text) {
  const lines = frontMatter(text).split(/\r?\n/);
  const at = lines.findIndex(l => /^unlocks:\s*$/.test(l));
  if (at === -1) return [];
  const entries = [];
  for (const l of lines.slice(at + 1)) {
    if (!/^\s/.test(l)) break;
    const m = /^\s+-\s+(.+?):\s+(.*)$/.exec(l);
    if (m) entries.push({ file: m[1].replace(/\s+\(new\)$/, '').trim(), reason: m[2] });
  }
  return entries;
}

const criteriaOf = text => new Set([...text.matchAll(/^\|\s*(AC-\d+)\s*\|/gm)].map(m => m[1]));

// The spec and criteria that unlock rel (a path relative to the project root), or null.
export function unlockedBy(rel, root, specsDir = 'docs/specs') {
  const dir = path.join(root, specsDir);
  if (!fs.existsSync(dir)) return null;
  const want = rel.replace(/\\/g, '/');
  for (const name of fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
    const text = fs.readFileSync(path.join(dir, name), 'utf8');
    const defined = criteriaOf(text);
    for (const entry of unlocksOf(text)) {
      if (entry.file !== want) continue;
      const cited = [...entry.reason.matchAll(/\bAC-\d+\b/g)].map(m => m[0]).filter(id => defined.has(id));
      if (cited.length) return { spec: name, criteria: cited };
    }
  }
  return null;
}
