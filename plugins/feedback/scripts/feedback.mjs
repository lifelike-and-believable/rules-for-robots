// Stub for the tests-first commit (docs/specs/feedback.md); the implementation follows.
export const FIELDS = [
  { id: 'area', label: 'Area' },
  { id: 'versions', label: 'Versions' },
  { id: 'happened', label: 'What happened' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'suggestion', label: 'Suggestion' },
  { id: 'source', label: 'Kind of project' },
];
export function issueBody() { return 'stub'; }
export function issueUrl() { return { url: 'https://example.com/stub', tooLong: true }; }
export function scanPrivate() { return [{ kind: 'stub', line: 0, text: '' }]; }
