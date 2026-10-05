// Shared parsing and validation for rule files. The specification is docs/rule-format.md.
import fs from 'node:fs';
import path from 'node:path';
import { parseDocument } from 'yaml';

export const LEVELS = ['MUST', 'SHOULD', 'MAY'];
export const VERIFIERS = ['hook', 'ci', 'test', 'review'];
export const FAILURES = [
  'test-gaming', 'scope-creep', 'over-engineering', 'destructive-action', 'data-loss',
  'invented-api', 'stale-knowledge', 'unverified-claim', 'security-regression',
  'secret-exposure', 'accessibility-regression', 'performance-regression',
  'convention-drift', 'project-decision',
];

// Prefix -> scope it may be used in. Keep in sync with the table in docs/rule-format.md.
export const PREFIXES = {
  WA: 'core', TEST: 'core', CODE: 'core', ARCH: 'core', SEC: 'core', PERF: 'core',
  A11Y: 'core', UX: 'core', API: 'core', DATA: 'core', OBS: 'core', DOC: 'core', GIT: 'core',
  WEB: 'pack:web-platform', TS: 'pack:typescript', NEXT: 'pack:react-nextjs',
  ASTRO: 'pack:static-sites', NODE: 'pack:node-services', PG: 'pack:node-services',
  UE: 'pack:unreal-plugin', FAB: 'pack:unreal-plugin',
};

export const REQUIRED = ['id', 'title', 'level', 'scope', 'verified-by', 'targets-failure', 'observed-on', 'rationale'];
export const KNOWN_FIELDS = new Set([...REQUIRED, 'paths', 'check', 'sources']);
export const WAIVER_FIELDS = new Set(['id', 'waiver', 'reason', 'approved-by', 'date']);

export const MAX_BODY_WORDS = 120;
export const MAX_ALWAYS_ON_LINES = 200;

// Phrases that over-trigger or misfire on current models (docs/rule-format.md, "Body").
const BANNED_PHRASES = [
  'critical', 'important:', 'never ever', 'think step by step', 'think carefully',
  'show your reasoning', 'explain your reasoning', 'double-check', 'double check',
  'if in doubt', 'when in doubt', 'only report important', 'only report high',
];
const BANNED_UPPERCASE_WORDS = ['MUST', 'SHOULD', 'MAY', 'ALWAYS', 'NEVER'];

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function listRuleFiles(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(path.join(entry.parentPath ?? entry.path, entry.name));
    }
  }
  return out.sort();
}

export function parseRuleFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const match = FRONTMATTER.exec(text);
  if (!match) return { file, text, error: 'missing YAML frontmatter delimited by --- lines' };
  const doc = parseDocument(match[1], { uniqueKeys: true, prettyErrors: false });
  if (doc.errors.length) return { file, text, error: `invalid YAML: ${doc.errors[0].message.split('\n')[0]}` };
  const meta = doc.toJS() ?? {};
  if (typeof meta !== 'object' || Array.isArray(meta)) return { file, text, error: 'frontmatter must be a mapping' };
  return { file, text, meta, body: match[2] };
}

// The text the model actually sees: HTML comments are stripped (experiment R7).
export function visibleBody(body) {
  return body.replace(/<!--[\s\S]*?-->/g, '').trim();
}

export function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

// Derive the expected scope from a path relative to the rules root, e.g.
// core/testing/X.md -> core, packs/unreal-plugin/build/X.md -> pack:unreal-plugin.
export function scopeFromPath(relPath) {
  const parts = relPath.split(/[\\/]/);
  if (parts[0] === 'core') return 'core';
  if (parts[0] === 'packs' && parts[1]) return `pack:${parts[1]}`;
  return null;
}

export function validateRule(rule, { rulesRoot, allowWaivers = false } = {}) {
  const errors = [];
  if (rule.error) return [rule.error];
  const { meta, body } = rule;

  if (meta.waiver === true) {
    if (!allowWaivers) return ['waivers belong in adopting repos, not in rules/'];
    for (const key of Object.keys(meta)) if (!WAIVER_FIELDS.has(key)) errors.push(`unknown waiver field "${key}"`);
    for (const key of ['id', 'reason', 'approved-by', 'date']) if (!meta[key]) errors.push(`waiver missing "${key}"`);
    if (visibleBody(body)) errors.push('a waiver has no body');
    return errors;
  }

  for (const key of REQUIRED) {
    if (meta[key] === undefined || meta[key] === null || meta[key] === '') errors.push(`missing required field "${key}"`);
  }
  for (const key of Object.keys(meta)) if (!KNOWN_FIELDS.has(key)) errors.push(`unknown field "${key}"`);

  const id = String(meta.id ?? '');
  const idMatch = /^([A-Z0-9]+)-(\d{3})$/.exec(id);
  if (meta.id !== undefined && !idMatch) errors.push(`id "${id}" must look like PREFIX-NNN`);
  const prefix = idMatch?.[1];
  if (prefix && !PREFIXES[prefix]) errors.push(`unknown id prefix "${prefix}"; add it to docs/rule-format.md and checks/lib/rules.mjs`);
  if (prefix && PREFIXES[prefix] && meta.scope && PREFIXES[prefix] !== meta.scope) {
    errors.push(`prefix "${prefix}" belongs to ${PREFIXES[prefix]}, not ${meta.scope}`);
  }

  const base = path.basename(rule.file, '.md');
  if (id && !new RegExp(`^${id}-[a-z0-9]+(-[a-z0-9]+)*$`).test(base)) {
    errors.push(`filename "${base}.md" must be "${id}-<kebab-case-slug>.md"`);
  }

  if (meta.level !== undefined && !LEVELS.includes(meta.level)) errors.push(`level must be one of ${LEVELS.join(', ')}`);

  if (meta.scope !== undefined && !/^(core|pack:[a-z0-9-]+)$/.test(meta.scope)) errors.push('scope must be "core" or "pack:<name>"');
  if (rulesRoot && meta.scope) {
    const expected = scopeFromPath(path.relative(rulesRoot, rule.file));
    if (expected && expected !== meta.scope) errors.push(`scope "${meta.scope}" does not match folder (${expected})`);
  }

  if (meta.paths !== undefined) {
    if (!Array.isArray(meta.paths) || meta.paths.length === 0 || !meta.paths.every(p => typeof p === 'string' && p.trim())) {
      errors.push('paths must be a non-empty list of glob strings');
    }
  }

  const verifiers = meta['verified-by'];
  if (verifiers !== undefined) {
    if (!Array.isArray(verifiers) || verifiers.length === 0) errors.push('verified-by must be a non-empty list');
    else {
      for (const v of verifiers) if (!VERIFIERS.includes(v)) errors.push(`verified-by value "${v}" must be one of ${VERIFIERS.join(', ')}`);
      if (meta.level === 'MUST' && !verifiers.some(v => v === 'hook' || v === 'ci')) {
        errors.push('a MUST rule needs "hook" or "ci" in verified-by');
      }
      if (verifiers.some(v => v === 'hook' || v === 'ci') && !meta.check) errors.push('"check" must name the hook or CI job');
    }
  }

  if (meta['targets-failure'] !== undefined && !FAILURES.includes(meta['targets-failure'])) {
    errors.push(`targets-failure "${meta['targets-failure']}" is not in the failure vocabulary`);
  }
  if (meta['observed-on'] !== undefined && !(Array.isArray(meta['observed-on']) && meta['observed-on'].every(m => typeof m === 'string'))) {
    errors.push('observed-on must be a list of model IDs (or [])');
  }
  if (meta.sources !== undefined && !(Array.isArray(meta.sources) && meta.sources.every(s => typeof s === 'string'))) {
    errors.push('sources must be a list of strings');
  }

  const visible = visibleBody(body ?? '');
  if (!visible) errors.push('body is empty');
  const words = wordCount(visible);
  if (words > MAX_BODY_WORDS) errors.push(`body has ${words} words; the limit is ${MAX_BODY_WORDS}`);
  const lower = visible.toLowerCase();
  for (const phrase of BANNED_PHRASES) if (lower.includes(phrase)) errors.push(`body uses banned phrase "${phrase}"`);
  for (const word of BANNED_UPPERCASE_WORDS) {
    if (new RegExp(`\\b${word}\\b`).test(visible)) errors.push(`body uses "${word}"; keep the level in frontmatter and write plain sentences`);
  }

  return errors;
}

export function validateTree(rulesRoot, options = {}) {
  const results = [];
  const seen = new Map();
  for (const file of listRuleFiles(rulesRoot)) {
    const rule = parseRuleFile(file);
    const errors = validateRule(rule, { rulesRoot, ...options });
    const id = rule.meta?.id;
    if (id) {
      if (seen.has(id)) errors.push(`duplicate id ${id} (also in ${path.relative(process.cwd(), seen.get(id))})`);
      else seen.set(id, file);
    }
    results.push({ file, rule, errors });
  }
  return results;
}

// Phase 4 exit criterion: every rule cites at least one practice guide that exists, and
// every guide is cited by at least one rule.
export function checkPracticeLinks(results, practicesDir) {
  const problems = [];
  const guides = fs.existsSync(practicesDir)
    ? fs.readdirSync(practicesDir).filter(f => f.endsWith('.md')).map(f => `practices/${f}`)
    : [];
  const cited = new Set();
  for (const { file, rule } of results) {
    if (!rule.meta || rule.meta.waiver) continue;
    const linked = (rule.meta.sources ?? []).filter(s => typeof s === 'string' && s.startsWith('practices/'));
    if (!linked.length) problems.push({ file, error: 'sources must include a practices/ guide' });
    for (const g of linked) {
      if (!guides.includes(g)) problems.push({ file, error: `practice guide ${g} does not exist` });
      cited.add(g);
    }
  }
  for (const g of guides) if (!cited.has(g)) problems.push({ file: path.join(practicesDir, path.basename(g)), error: 'no rule cites this guide' });
  return problems;
}
