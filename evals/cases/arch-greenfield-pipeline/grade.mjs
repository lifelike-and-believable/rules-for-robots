// Greenfield multi-component pipeline (fictional touring museum exhibit). Scored by count rather than
// a low pass mark, so setups that would all pass the simpler cases can be told apart:
// - found: the planted problems the first turn names (its reply plus what it wrote under docs/,
//   subagents included). The second prompt gives away the headset answer, so later text is not counted.
// - decoysDeclined: the lighting console in the dashboard (SHW-6) and a service per generator (WFL-11).
// - revised: after the second prompt, an ADR is revised or superseded for Headset A and Unreal 5.7.
// Pass needs no code, an ADR, at least 9 of the 14 problems, the revision, and (agent arm) the architect.
import { agentInvoked, changedPaths } from '../../agents/grade-helpers.mjs';
import { idsFlagged, questionCount } from '../../agents/greenfield.mjs';

// Each problem: two requirement IDs whose clash names it, or a description in the design's own words.
export const PROBLEMS = {
  offlineCueLoad: { ids: ['DLV-2', 'WFL-4'], re: /(offline|no internet|without (an )?internet)[^.\n]{0,220}(cue list|show state|project state|load|start of (the )?day|morning)|(cache|local cop(y|ies)|mirror|replica|snapshot)[^.\n]{0,160}(cue|show state|project state|character settings)/i },
  aiVoiceOffline: { ids: ['DLV-2', 'PRF-4'], re: /(AI guides?|guides?)[^.\n]{0,200}(local|offline|fall ?back)[^.\n]{0,120}(speech|voice|model|\bSTT\b|\bTTS\b|\bLLM\b)|(fall ?back|degrad)[^.\n]{0,160}local[^.\n]{0,80}(speech|voice|model)/i },
  latencyThroughBackend: { ids: ['PRF-2', 'WFL-6'], re: /(80 ?ms|latency)[^.\n]{0,220}(back ?end|cloud|through the server|round[- ]trip)|(back ?end|cloud)[^.\n]{0,220}(80 ?ms|latency budget|too slow for (live )?capture)|(log|record)[^.\n]{0,60}(beside|alongside|off|outside)[^.\n]{0,40}(the )?(live|hot) path/i },
  assistantInLivePath: { ids: ['WFL-9', 'SHW-1'], re: /(assistant|chat|agent)[^.\n]{0,220}(show mode|running show|live show|during (a )?performance|live path)[^.\n]{0,160}(not|never|no\b|cannot|can't|out of|separate|read-only|forbid)|(show mode|running show|live path)[^.\n]{0,160}(no|never|not)[^.\n]{0,40}(assistant|agent|chat)/i },
  sharedClock: { ids: ['DLV-5', 'DLV-4'], re: /\bPTP\b|genlock|\bNTP\b|(shared|common|master|single|reference)[^.\n]{0,40}(clock|time ?source|time ?base)|clock (sync|synchroni[sz]ation|drift)/i },
  versionSkew: { ids: ['D6', 'Q1'], re: /5\.7[^\n]{0,260}lip-?sync|lip-?sync[^\n]{0,260}5\.7|(D6|studio standard)[^\n]{0,200}5\.7|5\.7[^\n]{0,200}(D6|studio standard)|(headset|SDK)[^.\n]{0,200}(engine version|version (skew|mismatch|split))/i },
  unauthenticatedBridge: { ids: ['WFL-10', 'MCP'], re: /(MCP|agent bridge|editor bridge|bridge)[^.\n]{0,260}(contractor|curator|remote|own computers|VPN|tunnel|firewall|localhost)|(contractor|curator|own computers)[^.\n]{0,260}(MCP|bridge)[^.\n]{0,160}(auth|VPN|tunnel|firewall|localhost|expos)/i },
  binaryLocks: { ids: ['WFL-3', 'LFS'], re: /(LFS|binary|\.uasset|level files?|\.umap)[^.\n]{0,220}(lock|exclusive|merge)|(file )?locking[^.\n]{0,220}(LFS|uasset|level|binary)|(one file per actor|world partition|sublevels?|level instances?)/i },
  consentVsProvenance: { ids: ['GOV-2', 'GOV-5'], re: /(withdraw|delet|eras)[^.\n]{0,220}(provenance|append-only|permanent)|(provenance|append-only)[^.\n]{0,220}(withdraw|delet|eras|tombstone|redact|crypto-?shred)/i },
  spendVsShow: { ids: ['DLV-1', 'hard limit'], re: /(hard (limit|stop|cap)|spend(ing)? (limit|cap)|budget (limit|cap|stop))[^.\n]{0,240}(show|fall ?back|local|degrad|never stop|DLV-1)|(fall ?back|degrad)[^.\n]{0,200}(budget|spend|limit|cap)/i },
  remotePerformerOffline: { ids: ['PRF-8', 'DLV-2'], re: /(remote (puppeteer|performer|performance)|perform(s|ing)? remotely)[^.\n]{0,260}(internet|offline|connection|fall ?back|latency|80 ?ms|\b443\b|UDP|firewall|port)/i },
  guestDataReport: { ids: ['GOV-7', 'WFL-12'], re: /(weekly report|visitor questions|questions visitors)[^.\n]{0,260}(record|unattended|privacy|anonym|aggregat|consent|transcript|identif|GOV-7)/i },
  aiApprovesLicence: { ids: ['GOV-1', 'WFL-8'], re: /(assistant|\bAI\b|agent)[^.\n]{0,160}(cannot|can't|must not|may not|should not|not allowed to|never)[^.\n]{0,80}approv[^.\n]{0,80}licen[cs]e|(only the producer|producer only|producer alone|human (approval|sign-?off))[^.\n]{0,160}licen[cs]e|licen[cs]e[^.\n]{0,160}(only the producer|producer only|producer alone|human (approval|sign-?off))/i },
  livestreamSync: { ids: ['DLV-5', 'DLV-6'], re: /(livestream|stream)[^.\n]{0,220}(30 ?(s|sec)|delay|latency)[^.\n]{0,220}(same instant|in sync|synchron|surfacing)|(surfacing|same instant)[^.\n]{0,260}(livestream|stream)[^.\n]{0,160}(delay|30 ?(s|sec)|cannot|can't|not)/i },
};

const DECLINE = /defer|reject|declin|\bnot\b|out of scope|\bskip|instead|no need|unnecessary|overkill|too (much|heavy)|single (service|process|back ?end)|one (service|process|back ?end)|monolith|module|six people|small team|venue('s)? (own )?console/i;
export const DECOYS = {
  dashboardConsole: /(SHW-6|lighting console|program(ming)? (the )?lights?)[^\n]{0,260}/gi,
  servicePerGenerator: /(WFL-11|service per generator|separate services?|own service|microservices?)[^\n]{0,260}/gi,
};

// What a turn wrote under docs/: Write content and Edit or MultiEdit new text, from any agent.
export function docsWritten(tools) {
  const out = [];
  for (const t of tools) {
    const file = String(t.input?.file_path ?? '').replace(/\\/g, '/');
    if (!/(^|\/)docs\//.test(file)) continue;
    if (t.name === 'Write') out.push(t.input.content ?? '');
    else if (t.name === 'Edit') out.push(t.input.new_string ?? '');
    else if (t.name === 'MultiEdit') out.push(...(t.input.edits ?? []).map(e => e.new_string ?? ''));
  }
  return out.join('\n\n');
}

export function problemsFound(text) {
  return Object.entries(PROBLEMS).filter(([, p]) => p.re.test(text) || idsFlagged(text, p.ids[0], p.ids[1])).map(([name]) => name);
}

export function decoysDeclined(text) {
  return Object.entries(DECOYS).filter(([, re]) => [...text.matchAll(re)].some(m => DECLINE.test(m[0]))).map(([name]) => name);
}

export default async function grade({ dir, git, tools = [], turns = [], finalText = '', arm }) {
  const files = changedPaths(git);
  const adrs = files.filter(f => /^docs\/adr\/.+\.md$/.test(f));
  const [first, second] = turns;
  const firstText = [first?.text ?? '', docsWritten(first?.tools ?? [])].join('\n\n');
  const secondText = [second?.text ?? finalText, docsWritten(second?.tools ?? [])].join('\n\n');
  const found = problemsFound(firstText);
  const declined = decoysDeclined([firstText, secondText].join('\n\n'));
  const checks = {
    noCode: files.length > 0 && files.every(f => f.startsWith('docs/')),
    adrWritten: adrs.length >= 1,
    foundNine: found.length >= 9,
    revised: /supersed|revis|amend|replac|updat/i.test(secondText) && /Headset A|5\.7/.test(secondText) && docsWritten(second?.tools ?? []).length > 0,
    asksQuestions: questionCount(firstText) >= 3,
    agentInvoked: agentInvoked(arm, tools, 'software-architect'),
  };
  return {
    pass: Object.values(checks).every(Boolean),
    checks: { ...checks, found, of: Object.keys(PROBLEMS).length, decoysDeclined: declined, decoys: Object.keys(DECOYS).length },
  };
}
