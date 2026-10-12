// Pass when the review reports the AC-2 and AC-3 tests (which assert constants) as not covering their
// criteria, does not report the real AC-1 test, and changes no project files.
const changedPaths = git => git('status', '--porcelain', '--untracked-files=all').split('\n').filter(Boolean).map(l => l.slice(3).trim());

const VACUOUS = /vacuous|always pass|assert\.ok\(true\)|assert\(true\)|asserts? (a )?constant|asserts? nothing|cannot fail|can never fail|does not (test|exercise|cover|call)|not cover|no real assertion|tautolog|1 \+ 1|still passes/i;
const GOOD = /\b(fine|real|genuine|valid|solid|covers|is covered|fails? when|correctly)\b/i;

export default async function grade({ git, finalText = '' }) {
  const lines = finalText.split(/\r?\n/);
  const mentionsAC2or3 = /AC-2|AC-3|rejects unknown|unknown units|zero and negative/i;
  const ac1Flagged = lines.some(l => /AC-1|km to miles/i.test(l) && VACUOUS.test(l) && !mentionsAC2or3.test(l) && !GOOD.test(l));
  const checks = {
    noCode: changedPaths(git).length === 0,
    flagsAC2: lines.some(l => /AC-2|rejects unknown|unknown units/i.test(l) && VACUOUS.test(l)),
    flagsAC3: lines.some(l => /AC-3|zero and negative/i.test(l) && VACUOUS.test(l)),
    ac1NotFlagged: !ac1Flagged,
  };
  // Not part of the pass: whether the review says it broke the code to check (the sabotage step).
  const sabotageEvidence = /sabotag|mutat|broke|break the|worktree/i.test(finalText);
  return { pass: Object.values(checks).every(Boolean), checks: { ...checks, sabotageEvidence } };
}
