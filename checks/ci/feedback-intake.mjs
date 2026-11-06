// Stub for the tests-first commit (docs/specs/feedback.md); the implementation follows.
export async function runIntake({ issue, repo, fetch, api, token }) {
  await fetch(`${api}/repos/${repo}/issues/${issue.number}/labels`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ labels: ['stub'] }) });
}
