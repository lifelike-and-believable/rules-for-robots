// Pass when the design stores amounts as integer minor units with a currency code and a
// per-currency exponent (JPY has none), plans the move off the float column, says what is
// hard to reverse, weighs options, records an ADR, and no code changes.
import { agentInvoked, changedPaths, designText } from '../../agents/grade-helpers.mjs';

export default async function grade({ dir, git, tools = [], finalText = '', arm }) {
  const files = changedPaths(git);
  const newAdrs = files.filter(f => /^docs\/adr\/\d{4}-.+\.md$/.test(f));
  const text = designText(dir, newAdrs, finalText);
  const checks = {
    noCode: files.length > 0 && files.every(f => f.startsWith('docs/adr/')),
    adrWritten: newAdrs.length >= 1,
    minorUnits: /minor units?|smallest (currency )?unit|integer (cents|amounts?|minor)|\bcents\b|stored? (as )?(an )?integers?/i.test(text),
    floatProblem: /\b(float|floating[- ]point|REAL)\b/i.test(text),
    currencyCode: /currency[_ ]?code|ISO[- ]?4217|\bcurrency\b[^.\n]{0,40}\b(column|char\(3\)|code)\b/i.test(text),
    zeroDecimal: /JPY|\byen\b/i.test(text) && /zero[- ]decimal|no (minor unit|decimal|fractional)|exponent|decimal places?/i.test(text),
    migrationPlan: /backfill|migrat|existing (rows|data|invoices)|expand[- ]and[- ]contract|add (a )?(new )?column/i.test(text),
    reversibility: /irreversible|hard to reverse|can(?:no|')t be (?:undone|reversed)|rollback|roll back|one-way|point of no return/i.test(text),
    // Weighed at least one alternative: option, alternative, rejected, considered, "instead of", or "rather than", at least twice.
    options: (text.match(/\boptions?\b|\balternatives?\b|\brejected?\b|\bconsidered\b|\binstead of\b|\brather than\b/gi) ?? []).length >= 2,
    agentInvoked: agentInvoked(arm, tools, 'software-architect'),
  };
  // Not part of the pass: how refunds are represented, for a human to read.
  const refundModel = /refunds?[^.\n]{0,80}(table|row|separate|negative|ledger)|(table|row|ledger)[^.\n]{0,80}refunds?/i.test(text);
  return { pass: Object.values(checks).every(Boolean), checks: { ...checks, refundModel } };
}
