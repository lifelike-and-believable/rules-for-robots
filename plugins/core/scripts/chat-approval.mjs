// Approval in chat, never by prompt (docs/specs/default-allow.md, AC-10). The maintainer cannot judge
// a command's text, so a permission prompt protects nothing: every prompt was approved without being
// read. A guard that needs the person's decision refuses the call instead, and its reason tells the
// agent to ask in chat, in plain words, what it wants to do and why. If the person's next input says
// yes, the same call goes ahead without a prompt. This file is copied into every rfr plugin by the
// build, so each plugin's guards share it.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = () => process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), 'rfr-core');
const pendingDir = () => path.join(dataDir(), 'chat-pending');

// The call a refusal is about: the session, the tool, and its input, hashed, so the same call made
// again matches and any change to it does not.
export function callKey(input) {
  const body = JSON.stringify([input?.session_id ?? null, input?.tool_name ?? null, input?.tool_input ?? null]);
  return crypto.createHash('sha256').update(body).digest('hex').slice(0, 32);
}

// A reply that approves: yes, ok, sure, go ahead, do it, approved, proceed, fine, sounds good. A
// negation or a question anywhere in it does not.
const YES = /^\s*(?:yes|yep|yeah|yup|y|ok(?:ay)?|sure|go(?:\s+ahead)?|do\s+it|approved?|confirm(?:ed)?|proceed|fine|go\s+for\s+it|please\s+do|sounds\s+good|that'?s\s+fine)\b/i;
const NO = /\b(?:no|not|don'?t|do\s+not|never|stop|wait|hold|cancel)\b|\?\s*$/i;
export const isYes = text => typeof text === 'string' && YES.test(text) && !NO.test(text);

// The person's latest input in the transcript: { text, time } for a message they typed, or for their
// answer to the agent's own AskUserQuestion (the chosen labels). null when there is none.
export function latestPersonInput(transcriptPath) {
  if (!transcriptPath) return null;
  let lines;
  try {
    lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
  } catch {
    return null;
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].trim()) continue;
    let entry;
    try { entry = JSON.parse(lines[i]); } catch { continue; }
    if (entry?.type !== 'user' || entry.isSidechain || entry.isMeta) continue;
    const answers = entry.toolUseResult?.answers;
    if (answers && typeof answers === 'object') {
      const text = Object.values(answers).map(String).join(' ').trim();
      if (text) return { text, time: entry.timestamp ?? '' };
    }
    if (entry.origin?.kind !== 'human') continue;
    const content = entry.message?.content;
    const text = typeof content === 'string' ? content
      : Array.isArray(content) && !content.some(b => b?.type === 'tool_result') ? content.filter(b => b?.type === 'text').map(b => b.text).join('\n') : '';
    if (text.trim()) return { text: text.trim(), time: entry.timestamp ?? '' };
  }
  return null;
}

function pendingFile(key) {
  return path.join(pendingDir(), `${key}.json`);
}

// Whether the person said yes in chat after this call was refused: their latest input came after the
// refusal and approves. The approval is used once.
export function approvedInChat(input) {
  const file = pendingFile(callKey(input));
  let pending;
  try {
    pending = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return false;
  }
  const said = latestPersonInput(input?.transcript_path);
  if (!said || !isYes(said.text) || !(Date.parse(said.time) > Date.parse(pending.time))) return false;
  try { fs.rmSync(file, { force: true }); } catch { /* used once; a leftover file only means one more refusal */ }
  return said.text;
}

// Records a refusal, so the same call can go ahead once the person says yes.
export function recordRefusal(input, reason) {
  try {
    fs.mkdirSync(pendingDir(), { recursive: true });
    fs.writeFileSync(pendingFile(callKey(input)), JSON.stringify({ time: new Date().toISOString(), reason: String(reason).slice(0, 200) }));
  } catch {
    // Without a record the call is refused again, and the agent asks again: safe, never a prompt.
  }
}

// The refusal's reason: the guard's own reason, and how to get the person's decision.
export const chatQuestion = reason => `${reason} This needs the person's decision, and a permission prompt is not how to ask: do not retry it as it is. Ask them in chat, in plain words, what you want to do and why (not the command text). If they say yes, run the same call again unchanged and it will go ahead.`;
