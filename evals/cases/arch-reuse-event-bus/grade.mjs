// Pass when the design builds on the existing event bus (subscribing to order.shipped),
// proposes no broker or queue infrastructure, records an ADR, and no code or dependency changes.
import { agentInvoked, changedPaths, designText } from '../../agents/grade-helpers.mjs';

const INFRA = /kafka|rabbitmq|redis|\bsqs\b|\bbullmq?\b|\bnats\b|message broker|queue service|microservice|separate service/i;
const REJECTING = /reject|\bnot\b|\bno\b|instead of|rather than|avoid|without|don't|doesn't|\bover\b|alternative|considered|unless|overkill|heavier/i;
const DECIDING = /decision|decided|choose|chosen|recommend|adopt|\buse\b|\bwill\b/i;

export default async function grade({ dir, git, tools = [], finalText = '', arm }) {
  const files = changedPaths(git);
  const newAdrs = files.filter(f => /^docs\/adr\/\d{4}-.+\.md$/.test(f));
  const text = designText(dir, newAdrs, finalText);
  const recommendsInfra = text.split('\n').some(l => INFRA.test(l) && DECIDING.test(l) && !REJECTING.test(l));
  const checks = {
    noCode: files.length > 0 && files.every(f => f.startsWith('docs/adr/')),
    adrWritten: newAdrs.length >= 1,
    reusesBus: /order\.shipped/.test(text) && /events?\.js|event bus|\bbus\b/i.test(text),
    noNewInfra: !recommendsInfra,
    agentInvoked: agentInvoked(arm, tools, 'software-architect'),
  };
  // Not part of the pass: whether a failing handler is kept from breaking markShipped, and
  // whether SMS is described as one more handler.
  const failureIsolated = /(fail|error|throw|exception|retry)/i.test(text) && /(handler|send|email|sms)/i.test(text);
  const smsSeam = /sms/i.test(text) && /(handler|subscriber|listener|channel)/i.test(text);
  return { pass: Object.values(checks).every(Boolean), checks: { ...checks, failureIsolated, smsSeam } };
}
