// Whether a tool call approves a pull request (docs/specs/github-gate.md, AC-9). Under the GitHub
// gate the approver's review is the approval, and a session holds the approver's token, so an agent
// could give it in their name. This one action is refused, whatever the session was told.
import { executedText } from './guard-commands.mjs';
import { refuseReason } from './lib.mjs';

// gh pr review with --approve or -a (alone or first in a group of short flags).
const GH_REVIEW = /\bgh\s+pr\s+review\b[^;&|\n]*\s(--approve(=\S*)?|-a[a-zA-Z]*)(?=\s|$)/;
// The REST and GraphQL ways to give a review: a reviews endpoint (POST .../pulls/<n>/reviews, or
// .../reviews/<id>/events to submit a pending one), or the GraphQL mutations, with the APPROVE event.
const REVIEW_API = /pulls\/[^\s/'"]+\/reviews\b|\b(addPullRequestReview|submitPullRequestReview)\b/;
const APPROVE_EVENT = /\bAPPROVE\b/;
// A reviews endpoint whose body comes from a file the guard cannot read.
const FROM_FILE = /\s--input(=|\s)/;

// For a shell command: 'approve' when it approves a pull request, 'unread' when it sends a review
// whose event is in a file, or null.
export function commandApprovesPr(command) {
  if (typeof command !== 'string') return null;
  // Quoted prose (a commit message, an echo of the line the lead runs) is joined into one word by
  // executedText, so it does not match; a command line the shell cannot read is matched whole.
  if (GH_REVIEW.test(executedText(command) ?? command)) return 'approve';
  if (!REVIEW_API.test(command)) return null;
  if (APPROVE_EVENT.test(command)) return 'approve';
  return /\bgh\s+api\b/.test(command) && FROM_FILE.test(command) && /pulls\/[^\s/'"]+\/reviews\b/.test(command) ? 'unread' : null;
}

// For an MCP tool call: true when a GitHub tool that gives a review is called with the APPROVE event
// (create_pull_request_review, create_and_submit_pull_request_review,
// submit_pending_pull_request_review, pull_request_review_write).
export function toolApprovesPr(toolName, toolInput) {
  if (typeof toolName !== 'string' || !/^mcp__.*github.*__.*review/i.test(toolName)) return false;
  let input = toolInput;
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input);
    } catch {
      return APPROVE_EVENT.test(input);
    }
  }
  return /^\s*approve\s*$/i.test(String(input?.event ?? ''));
}

const NEXT = 'The approver gives this review themselves, in GitHub. Tell them once that the pull request is ready, with the link to its review page, and that they can approve from the Claude Code prompt with `! gh pr review <number> --approve`; then carry on with other work, or end the turn';

export const approveReason = refuseReason({ source: 'rfr-core (github-gate AC-9)', action: 'agents do not approve pull requests: the approver\'s review is the approval, and this session acts with their token', next: NEXT });
export const unreadReason = refuseReason({ source: 'rfr-core (github-gate AC-9)', action: 'this command sends a pull request review whose event is in a file, so the guard cannot tell whether it approves', next: 'Give a comment or a request for changes with the event in the command (-f event=COMMENT); agents do not approve pull requests' });
