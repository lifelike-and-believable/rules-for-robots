// The model evidence ledger (docs/specs/model-adaptation.md, AC-4 to AC-6): which rules,
// agents, and skills have evidence on which model. evals/ledger.json holds two lists:
//   entries: { subject, kind, model, verdict, evidence, results, date }
//            subject is a rule ID, "agent:<name>", or "skill:<name>"
//   cases:   { case, model, none, rules, saturated, results, date }
// Entries are added from committed results by checks/model-ledger.mjs; nothing here
// reads the network or writes outside the ledger file.
import fs from 'node:fs';
import path from 'node:path';

export const VERDICTS = ['effective', 'no-effect', 'negative', 'saturated', 'not-run'];
// When one results folder holds several cases for a rule, the verdict that most needs a
// person's attention wins: a rule that helps on one case and hurts on another is negative.
const PRIORITY = ['negative', 'effective', 'no-effect', 'saturated', 'not-run'];
export const LEGACY_SMOKE_MODEL = 'claude-sonnet-5-5';

export function emptyLedger() {
  return { entries: [], cases: [] };
}

export function readLedger(file) {
  if (!fs.existsSync(file)) return emptyLedger();
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { entries: data.entries ?? [], cases: data.cases ?? [] };
}

export function writeLedger(file, ledger) {
  const sortBy = (list, key) => [...list].sort((a, b) => a[key].localeCompare(b[key]) || a.model.localeCompare(b.model));
  const out = { entries: sortBy(ledger.entries, 'subject'), cases: sortBy(ledger.cases, 'case') };
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
}

// A rule's verdict on one case and model, from the no-rules arm and a rules arm.
// Each cell is { passes, runs }, or undefined when that arm did not run.
export function verdictFor(none, rules) {
  if (!none || !rules || !none.runs || !rules.runs) return 'not-run';
  const noneRate = none.passes / none.runs;
  const rulesRate = rules.passes / rules.runs;
  if (rulesRate > noneRate) return 'effective';
  if (rulesRate < noneRate) return 'negative';
  if (none.passes === none.runs) return 'saturated';
  return 'no-effect';
}

const cellText = c => (c ? `${c.passes}/${c.runs}` : null);

// Pass counts per case and model. The model is the one the session reported when the run
// recorded it, so an alias or a fallback counts against the model that actually ran.
// The rules arm is "rules", or "rules+hooks" for a case that ran only that.
export function cellsFrom(records) {
  const cells = new Map();
  for (const r of records) {
    const model = r.reportedModel ?? r.model;
    const key = `${r.case}|${model}`;
    if (!cells.has(key)) cells.set(key, { case: r.case, model, arms: {} });
    const arms = cells.get(key).arms;
    arms[r.arm] ??= { passes: 0, runs: 0 };
    arms[r.arm].runs++;
    if (r.pass) arms[r.arm].passes++;
  }
  return [...cells.values()].map(c => ({ ...c, none: c.arms.none, rules: c.arms.rules ?? c.arms['rules+hooks'] }));
}

// Ledger entries from an eval run's records. caseRules maps a case name to the rule IDs it
// tests (case.json "rules").
export function entriesFromRuns(records, caseRules, { results, date }) {
  const byRule = new Map();
  const cases = [];
  for (const cell of cellsFrom(records)) {
    if (cell.none) {
      cases.push({ case: cell.case, model: cell.model, none: cellText(cell.none), rules: cellText(cell.rules), saturated: cell.none.passes === cell.none.runs, results, date });
    }
    const verdict = verdictFor(cell.none, cell.rules);
    if (verdict === 'not-run') continue;
    for (const id of caseRules[cell.case] ?? []) {
      const key = `${id}|${cell.model}`;
      if (!byRule.has(key)) byRule.set(key, { subject: id, kind: 'rule', model: cell.model, verdicts: [], evidence: [] });
      const e = byRule.get(key);
      e.verdicts.push(verdict);
      e.evidence.push({ case: cell.case, none: cellText(cell.none), rules: cellText(cell.rules), verdict });
    }
  }
  const entries = [...byRule.values()].map(({ verdicts, ...e }) => ({
    ...e, verdict: PRIORITY.find(v => verdicts.includes(v)), results, date,
  }));
  return { entries, cases };
}

// "code-reviewer: off-by-one" -> agent:code-reviewer; "skill review-pr: planted bug" -> skill:review-pr.
export function smokeSubject(name) {
  const head = String(name).split(':')[0].trim();
  const skill = /^skill\s+(\S+)$/.exec(head);
  return skill ? { subject: `skill:${skill[1]}`, kind: 'skill' } : { subject: `agent:${head}`, kind: 'agent' };
}

// Ledger entries from smoke test results: a subject whose smoke cases all passed is
// effective on the main session's model; any failure makes it negative. Results recorded
// before smoke.mjs wrote a model used claude-sonnet-5-5 for the main session.
export function entriesFromSmoke(records, { results, date }) {
  const groups = new Map();
  for (const r of records) {
    const { subject, kind } = smokeSubject(r.name);
    const model = r.model ?? LEGACY_SMOKE_MODEL;
    const key = `${subject}|${model}`;
    if (!groups.has(key)) groups.set(key, { subject, kind, model, evidence: [] });
    groups.get(key).evidence.push({ case: r.name, pass: !!r.pass, models: Object.keys(r.models ?? {}) });
  }
  const entries = [...groups.values()].map(g => ({
    ...g, verdict: g.evidence.every(e => e.pass) ? 'effective' : 'negative', results, date,
  }));
  return { entries, cases: [] };
}

// Adds entries, replacing any for the same subject (or case) and model.
export function mergeLedger(ledger, added) {
  const entryKeys = new Set(added.entries.map(e => `${e.subject}|${e.model}`));
  const caseKeys = new Set(added.cases.map(c => `${c.case}|${c.model}`));
  return {
    entries: [...ledger.entries.filter(e => !entryKeys.has(`${e.subject}|${e.model}`)), ...added.entries],
    cases: [...ledger.cases.filter(c => !caseKeys.has(`${c.case}|${c.model}`)), ...added.cases],
  };
}

// Reads a results folder: runs-corrected.json (when a run's grades were corrected),
// runs.json, or smoke.json.
export function readResults(folder) {
  for (const [file, kind] of [['runs-corrected.json', 'runs'], ['runs.json', 'runs'], ['smoke.json', 'smoke']]) {
    const full = path.join(folder, file);
    if (fs.existsSync(full)) return { kind, file, records: JSON.parse(fs.readFileSync(full, 'utf8')) };
  }
  return null;
}

// What the ledger says about one model. rules is [{ id, level }] from the rule tree.
export function report(ledger, rules, model) {
  const onModel = ledger.entries.filter(e => e.model === model);
  const ruleIds = new Set(rules.map(r => r.id));
  const byId = new Map(onModel.map(e => [e.subject, e]));
  const tested = rules.filter(r => byId.has(r.id)).map(r => {
    const e = byId.get(r.id);
    return { id: r.id, level: r.level, verdict: e.verdict, evidence: e.evidence, results: e.results, date: e.date };
  });
  return {
    model,
    rules: tested,
    untested: rules.filter(r => !byId.has(r.id)).map(r => ({ id: r.id, level: r.level })),
    others: onModel.filter(e => !ruleIds.has(e.subject)).map(e => ({ subject: e.subject, kind: e.kind, verdict: e.verdict, results: e.results, date: e.date })),
    saturated: ledger.cases.filter(c => c.model === model && c.saturated).map(c => ({ case: c.case, none: c.none, results: c.results })),
  };
}

// Subjects whose verdict differs between two models, including ones with evidence on only one.
export function compare(ledger, from, to) {
  const verdicts = model => new Map(ledger.entries.filter(e => e.model === model).map(e => [e.subject, e.verdict]));
  const a = verdicts(from);
  const b = verdicts(to);
  const subjects = [...new Set([...a.keys(), ...b.keys()])].sort();
  return subjects
    .filter(s => a.get(s) !== b.get(s))
    .map(s => ({ subject: s, [from]: a.get(s) ?? 'not-run', [to]: b.get(s) ?? 'not-run' }));
}

// Lint warnings where a rule's evaluated-on field and the ledger's effective verdicts disagree.
export function evaluatedOnWarnings(results, ledger) {
  const effective = new Map();
  for (const e of ledger.entries) {
    if (e.kind !== 'rule' || e.verdict !== 'effective') continue;
    if (!effective.has(e.subject)) effective.set(e.subject, new Set());
    effective.get(e.subject).add(e.model);
  }
  const warnings = [];
  for (const { file, rule } of results) {
    const id = rule.meta?.id;
    if (!id || rule.meta.waiver) continue;
    const listed = new Set(Array.isArray(rule.meta['evaluated-on']) ? rule.meta['evaluated-on'] : []);
    const ledgerModels = effective.get(id) ?? new Set();
    for (const m of listed) if (!ledgerModels.has(m)) warnings.push({ file, warning: `evaluated-on names ${m}, but evals/ledger.json has no effective verdict for ${id} on it` });
    for (const m of ledgerModels) if (!listed.has(m)) warnings.push({ file, warning: `evals/ledger.json shows ${id} effective on ${m}; add it to evaluated-on` });
  }
  return warnings;
}
