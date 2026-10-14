// Helpers for the greenfield cases (arch-greenfield-*, lead-greenfield-*): a requirements file
// with numbered requirements (R1, R2, ...) and problems planted in it.

const CONFLICT_WORDS = /conflict|contradict|tension|incompatib|can't both|cannot both|can not both|at odds|reconcil|mutually|clash|inconsisten/i;

// The requirement numbers a text refers to, as a Set of integers.
export function requirementsMentioned(text, max) {
  const ids = new Set();
  for (const m of text.matchAll(/\bR(\d{1,2})\b/g)) if (Number(m[1]) >= 1 && Number(m[1]) <= max) ids.add(Number(m[1]));
  return ids;
}

// True when two requirements are named close together with a word that says they clash.
export function conflictFlagged(text, a, b, window = 400) {
  const first = new RegExp(`\\bR${a}\\b`, 'g');
  for (const m of text.matchAll(first)) {
    const near = text.slice(Math.max(0, m.index - window), m.index + window);
    if (new RegExp(`\\bR${b}\\b`).test(near) && CONFLICT_WORDS.test(near)) return true;
  }
  return false;
}

// Lines that ask the person something: a question mark, outside code fences.
export function questionCount(text) {
  let inCode = false;
  let n = 0;
  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) inCode = !inCode;
    else if (!inCode && /\?/.test(line)) n++;
  }
  return n;
}

export const OPTION_WORDS = /\boptions?\b|\balternatives?\b|\brejected?\b|\bconsidered\b|\binstead of\b|\brather than\b/gi;
