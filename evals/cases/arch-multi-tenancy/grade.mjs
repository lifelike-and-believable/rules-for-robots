// Large rung of the architect's complexity ladder. Pass when the design finds at least four of the six
// constraints that sit in the repo, weighs a tenant column against a database per tenant, plans the
// move for existing data, names what is hard to reverse, records an ADR, and no code changes.
import { agentInvoked, changedPaths, designText, plantedFound } from '../../agents/grade-helpers.mjs';

export const CONSTRAINTS = {
  uniqueEmail: /\bemail\b[^.\n]{0,120}(unique|per[- ]tenant|scoped)|(unique|scoped)[^.\n]{0,120}\bemail\b/i,
  cacheKeys: /cache(\.js)?[^.\n]{0,160}(key|tenant|leak|scope|namespace)|(key|namespace)[^.\n]{0,80}cache/i,
  reports: /reports\.js|monthlyRevenue|openBalanceByUser/i,
  nightlyJob: /jobs\.js|nightlyReminders|nightly (job|reminder)/i,
  invoiceNumbers: /invoice numbers?|\bnumber\b[^.\n]{0,120}(per[- ]tenant|sequen|MAX|unique|global)|MAX\(number\)/i,
  session: /auth\.js|currentUser|session[^.\n]{0,120}(tenant|user ?id|only)/i,
};

export default async function grade({ dir, git, tools = [], finalText = '', arm }) {
  const files = changedPaths(git);
  const newAdrs = files.filter(f => /^docs\/adr\/\d{4}-.+\.md$/.test(f));
  const text = designText(dir, newAdrs, finalText);
  const { found, count } = plantedFound(text, CONSTRAINTS);
  const checks = {
    noCode: files.length > 0 && files.every(f => f.startsWith('docs/adr/')),
    adrWritten: newAdrs.length >= 1,
    foundFour: count >= 4,
    bothIsolationOptions: /tenant[_ ]?id|tenant column|shared (database|schema|tables)/i.test(text) && /(database|db|file)[- ]per[- ]tenant|separate (database|db|file)s?|per-tenant (database|db|file)/i.test(text),
    migrationPlan: /existing (data|rows|invoices|users)|backfill|first tenant|default tenant|migrat/i.test(text),
    reversibility: /irreversible|hard to reverse|can(?:no|')t be (?:undone|reversed)|rollback|roll back|one-way|point of no return/i.test(text),
    agentInvoked: agentInvoked(arm, tools, 'software-architect'),
  };
  return { pass: Object.values(checks).every(Boolean), checks: { ...checks, found, of: Object.keys(CONSTRAINTS).length } };
}
