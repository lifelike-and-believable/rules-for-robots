// Tutorial step grammar (docs/specs/project-process.md, stage 12). A web tutorial is its own test:
// each numbered step under "## Steps" is read as browser actions and checks, so the words a reader
// follows are the words that run. Sentences, case-insensitive:
//   Open `/path`.  Go to `/path`.                    -> load the page
//   Type `text` into **Label**.  Enter `text` in **Label**.   -> fill the field with that label
//   Choose `option` from **Label**.  Select `option` in **Label**. -> pick from a list
//   Check **Label**.  Tick **Label**.  Uncheck **Label**.       -> set a checkbox
//   Click **Name**.  Select **Name**.  Press **Name**.  Choose **Name**. -> press a button, link, tab, or text
//   ... you see **Text**.  **Text** appears.          -> the text is on the page
//   Sign in as **Name**.                              -> sign the step's session in as that person
// Other sentences are narration. A step needs at least one action or check, unless it ends with
// "(manual)", which the runner skips. Labels and names match exactly; seen text matches a part.
//
// People (docs/specs/lasting-tutorials.md, AC-3). A step that begins "As **Name**:" is done by that
// person, in a browser session of their own. A step with no name is done by the tutorial's first
// person: the first name in the tutorial, in step order, from "As **Name**:" or "Sign in as
// **Name**.". A tutorial that names nobody has no person, and runs in one unnamed session as before.
// A session signs in as its own person only, so "Sign in as **Name**." in a step done by someone
// else is an error.
// Dependency-free.

const ACTIONS = [
  [/^sign in as\s+\*\*(.+?)\*\*/i, m => ({ type: 'signin', name: m[1].trim() })],
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

// "As **Name**:" at the start of a step, and the forms of it that are probably mistakes: a bold name
// without the colon, a name of one to three capitalised words with a colon but no bold ("As Jordan:"),
// and a person named after the start. "As before, ..." stays narration.
const AS = /^as\s+\*\*([^*]+?)\*\*:\s*/i;
const AS_BOLD = /^as\s+\*\*/i;
const AS_PLAIN = /^As\s+[A-Z][\w'.-]*(?:\s+[A-Z][\w'.-]*){0,2}:/;
const AS_INSIDE = /(?:^|\s)as\s+\*\*[^*]+?\*\*:/i;
const SIGN_IN_PLAIN = /(?:^|[.!?]\s+)sign in as\s+(?!\*\*)\S/i;

// Reads the numbered list under "## Steps". Continuation lines (indented) join their step.
// Each step gets n, text, manual, actions, as (its own "As **Name**:", or null), and person (who
// does it, or null when the tutorial names nobody).
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
    const as = AS.exec(step.text);
    step.rest = as ? step.text.slice(as[0].length) : step.text;
    step.as = as ? as[1].trim() : null;
    step.manual = /\(manual\)\s*$/i.test(step.rest);
    step.actions = step.manual ? [] : parseStep(step.rest);
  }
  // The people this tutorial uses: named by a well-formed "As **Name**:" or a sign-in sentence.
  const people = new Set(steps.flatMap(s => [s.as, ...s.actions.filter(a => a.type === 'signin').map(a => a.name)]).filter(Boolean).map(n => n.toLowerCase()));
  for (const step of steps) {
    const at = `step ${step.n} ("${step.text}")`;
    const text = step.rest;
    delete step.rest;
    // A step the runner can do nothing with gets the most specific message that fits. A near miss of
    // the person forms is otherwise an error only when it names a person this tutorial uses: prose
    // that ran before people existed ("As **bold** text shows, you see **Done**.") still runs.
    const idle = !step.manual && !step.actions.length;
    const named = /^as\s+\*\*([^*]+?)\*\*/i.exec(step.text)?.[1]?.trim().toLowerCase();
    if (!step.as && ((AS_BOLD.test(step.text) && (idle || people.has(named))) || (AS_PLAIN.test(step.text) && idle))) {
      errors.push(`${at} names a person but not in the form "As **Name**: <step>"; write the name in bold, then a colon, then the step`);
      continue;
    }
    const inside = /(?:^|\s)as\s+\*\*([^*]+?)\*\*:/i.exec(text)?.[1]?.trim().toLowerCase();
    // "... . As **Name**:" as a new sentence is the person form in the wrong place, whoever it names.
    const sentence = /[.!?]\s+As\s+\*\*[^*]+?\*\*:/.test(text);
    if (AS_INSIDE.test(text) && (idle || sentence || people.has(inside))) {
      errors.push(`${at} names a person after its start; "As **Name**:" goes only at the start of a step, so make it a step of its own`);
      continue;
    }
    if (idle && SIGN_IN_PLAIN.test(text)) errors.push(`${at} signs in without a name in bold; write "Sign in as **Name**."`);
    else if (idle) {
      errors.push(`${at} has no action or check the runner can perform; write it as "Click **Name**", "Type \`text\` into **Label**", "You see **Text**", and so on, or end it with "(manual)"`);
    }
  }
  // Who does each step: its own "As **Name**:", or else the first person named in the tutorial.
  const first = steps.map(s => s.as ?? s.actions?.find(a => a.type === 'signin')?.name).find(Boolean) ?? null;
  for (const step of steps) {
    step.person = step.as ?? first;
    for (const a of step.actions) {
      if (a.type === 'signin' && step.person && a.name !== step.person) {
        errors.push(`step ${step.n} ("${step.text}") signs in as **${a.name}**, but is done by **${step.person}**; begin it with "As **${a.name}**:" so the sign-in happens in ${a.name}'s own session`);
      }
    }
  }
  return { steps, errors };
}

// A tutorial can start where another ends (lasting-tutorials AC-4): "starts-from: <tutorial id>" in
// its front matter. Read here with a small regular expression, as the runner reads "runner:".
export function startsFromOf(text) {
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '';
  // null when the line is absent; '' when it is there and names nothing, which is a mistake to report.
  return /^starts-from:[ \t]*(.*?)\s*$/m.exec(front)?.[1] ?? null;
}

// Problems with the starts-from names of a set of tutorials, given as [{ id, startsFrom }]: a name
// that is not one of their ids, and each cycle once (a tutorial that names itself is a cycle).
// Returns [{ id, message }], where id is null for a cycle.
export function startsFromProblems(tutorials) {
  const next = new Map(tutorials.filter(t => t.id).map(t => [t.id, t.startsFrom ?? null]));
  const out = [];
  for (const [id, target] of next) {
    if (target === '') out.push({ id, message: `${id}: starts-from names no tutorial; give the id of the tutorial it starts from, or remove the line` });
    if (target && !next.has(target)) out.push({ id, message: `${id}: starts-from names ${target}, which is not the id of a tutorial` });
  }
  const reported = new Set();
  for (const start of next.keys()) {
    const trail = [];
    let id = start;
    while (id && next.has(id) && !trail.includes(id)) { trail.push(id); id = next.get(id); }
    if (!id || !trail.includes(id)) continue;
    const cycle = trail.slice(trail.indexOf(id));
    const key = [...cycle].sort().join(',');
    if (reported.has(key)) continue;
    reported.add(key);
    // Start the cycle at its first id in sort order, so the message is the same whatever the file order.
    const lowest = cycle.indexOf([...cycle].sort()[0]);
    const ordered = [...cycle.slice(lowest), ...cycle.slice(0, lowest)];
    out.push({ id: null, message: `starts-from cycle: ${[...ordered, ordered[0]].join(' -> ')}` });
  }
  return out;
}

// A lasting tutorial names the product's pages by path and nothing about a machine or a build
// (docs/specs/lasting-tutorials.md, AC-2). Returns the problems found in a tutorial's body.
//
// An "inline shell command" is an inline code span in "Before you start" or "Steps" whose text
// starts with a known command runner followed by a space (npm, pnpm, yarn, npx, node, docker, git,
// bun, deno, python, pip, make, curl, cd, sudo, bash), or with a shell prompt ("$ "). Step-grammar
// code such as Open `/path` and Type `text` into **Label** is not a command, so it passes.
// A fenced code block in either section is always a problem. A runner: unreal or runner: manual
// tutorial is exempt from the shell rules only, because it may name a tool the reader installs.
const SHELL_RUNNER = /^(?:\$\s+|(?:npm|pnpm|yarn|npx|node|docker|git|bun|deno|python3?|pip|make|curl|cd|sudo|bash)\s)/i;

const sectionOf = (body, name) => new RegExp(String.raw`^##\s+${name}\s*\n([\s\S]*?)(?=^##\s|$(?![\s\S]))`, 'im').exec(body)?.[1] ?? '';

export function bodyProblems(body, runner) {
  const out = [];
  // "localhost" as a host, not as part of a longer name in a path (`/docs/localhost-setup`).
  if (/(?<![-\w])localhost(?![-\w])|\b127(?:\.\d{1,3}){3}\b|\b0\.0\.0\.0\b|\[::1\]/i.test(body)) out.push('names a machine (localhost or a loopback address); name pages by path, such as `/dashboard`, because the reader opens the product wherever it runs');
  const { steps } = parseSteps(body);
  for (const step of steps) {
    for (const a of step.actions ?? []) {
      if (a.type === 'goto' && /^https?:\/\//i.test(a.path)) out.push(`step ${step.n} opens the product by an absolute address (${a.path}); open it by path, such as \`/dashboard\``);
    }
  }
  if (/^#{1,6}\s+run record\s*$/im.test(body)) out.push('has a "Run record" heading; a run record belongs in the delivery record, not in a tutorial the reader follows');
  if (runner !== 'unreal' && runner !== 'manual') {
    for (const name of ['Before you start', 'Steps']) {
      const section = sectionOf(body, name);
      if (/^\s*(?:```|~~~)/m.test(section)) out.push(`"${name}" has a fenced code block; a tutorial names no command, so move how to start or build the product out of it`);
      const prose = section.replace(/^\s*(```|~~~)[\s\S]*?^\s*\1.*$/gm, '');
      // What a step types, chooses, or opens is the reader's input, whatever word it starts with.
      const outside = prose.replace(/\b(?:Type|Choose|Open)\s+`[^`\n]+`/g, '');
      const cmd = [...outside.matchAll(/`([^`\n]+)`/g)].map(m => m[1].trim()).find(c => SHELL_RUNNER.test(c));
      if (cmd) out.push(`"${name}" has a shell command (\`${cmd}\`); a tutorial names no command, so move how to start or build the product out of it`);
    }
  }
  return out;
}
