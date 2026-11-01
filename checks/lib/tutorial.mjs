// Tutorial step grammar (docs/specs/project-process.md, stage 12). A web tutorial is its own test:
// each numbered step under "## Steps" is read as browser actions and checks, so the words a reader
// follows are the words that run. Sentences, case-insensitive:
//   Open `/path`.  Go to `/path`.                    -> load the page
//   Type `text` into **Label**.  Enter `text` in **Label**.   -> fill the field with that label
//   Choose `option` from **Label**.  Select `option` in **Label**. -> pick from a list
//   Check **Label**.  Tick **Label**.  Uncheck **Label**.       -> set a checkbox
//   Click **Name**.  Select **Name**.  Press **Name**.  Choose **Name**. -> press a button, link, tab, or text
//   ... you see **Text**.  **Text** appears.          -> the text is on the page
// Other sentences are narration. A step needs at least one action or check, unless it ends with
// "(manual)", which the runner skips. Labels and names match exactly; seen text matches a part.
// Dependency-free.

const ACTIONS = [
  [/^(?:open|go to)\s+`([^`]+)`/i, m => ({ type: 'goto', path: m[1] })],
  [/^(?:type|enter)\s+`([^`]*)`\s+(?:into|in)\s+(?:the\s+)?\*\*(.+?)\*\*/i, m => ({ type: 'fill', label: m[2], value: m[1] })],
  [/^(?:choose|select|pick)\s+`([^`]+)`\s+(?:from|in)\s+(?:the\s+)?\*\*(.+?)\*\*/i, m => ({ type: 'select', label: m[2], value: m[1] })],
  [/^(?:check|tick)\s+\*\*(.+?)\*\*/i, m => ({ type: 'check', label: m[1] })],
  [/^(?:uncheck|untick|clear)\s+\*\*(.+?)\*\*/i, m => ({ type: 'uncheck', label: m[1] })],
  [/^(?:click|select|press|choose|open)\s+(?:the\s+)?\*\*(.+?)\*\*/i, m => ({ type: 'click', label: m[1] })],
];
const SEE = /\bsee\s+((?:\*\*.+?\*\*(?:\s*(?:,|and)\s*)?)+)/i;
const APPEARS = /\*\*(.+?)\*\*\s+(?:appears|is shown|is displayed)/i;

function sentences(text) {
  // Split after a full stop, question mark, or exclamation mark that is outside backticks and bold.
  const out = [];
  let buf = '';
  let code = false;
  let bold = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '`') code = !code;
    if (!code && c === '*' && text[i + 1] === '*') { bold = !bold; buf += '**'; i++; continue; }
    buf += c;
    if (!code && !bold && /[.!?]/.test(c) && (i + 1 === text.length || /\s/.test(text[i + 1]))) { out.push(buf.trim()); buf = ''; }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

export function parseStep(text) {
  const actions = [];
  for (const sentence of sentences(text)) {
    const s = sentence.replace(/^(?:then|now|next|finally|and)\s*,?\s+/i, '');
    for (const [re, make] of ACTIONS) {
      const m = re.exec(s);
      if (m) { actions.push(make(m)); break; }
    }
    const see = SEE.exec(sentence);
    if (see) for (const b of see[1].matchAll(/\*\*(.+?)\*\*/g)) actions.push({ type: 'see', text: b[1] });
    else {
      const appears = APPEARS.exec(sentence);
      if (appears) actions.push({ type: 'see', text: appears[1] });
    }
  }
  return actions;
}

// Reads the numbered list under "## Steps". Continuation lines (indented) join their step.
export function parseSteps(body) {
  const section = /^##\s+Steps\s*\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/m.exec(body)?.[1];
  if (section === undefined) return { steps: [], errors: ['no "## Steps" section'] };
  const steps = [];
  for (const line of section.split(/\r?\n/)) {
    const item = /^\s{0,3}(\d+)[.)]\s+(.*)$/.exec(line);
    if (item) steps.push({ n: steps.length + 1, text: item[2].trim() });
    else if (steps.length && line.trim() && /^\s+/.test(line)) steps.at(-1).text += ` ${line.trim()}`;
  }
  const errors = [];
  if (!steps.length) errors.push('the "## Steps" section has no numbered steps');
  for (const step of steps) {
    step.manual = /\(manual\)\s*$/i.test(step.text);
    step.actions = step.manual ? [] : parseStep(step.text);
    if (!step.manual && !step.actions.length) {
      errors.push(`step ${step.n} ("${step.text}") has no action or check the runner can perform; write it as "Click **Name**", "Type \`text\` into **Label**", "You see **Text**", and so on, or end it with "(manual)"`);
    }
  }
  return { steps, errors };
}
