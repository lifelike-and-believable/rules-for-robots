---
name: revise
description: Change something the lead already approved (a design, user documentation, a story, a decision note, a requirement) and deal with every document that cites it, on one branch, as a revision packet for the lead's approval. Use when the lead asks to change an approved document, or when a change of theirs reaches documents that others cite.
argument-hint: "[document id and section to change]"
---

# Revise approved documents

A revision changes a document the lead has approved. Other documents cite its sections, so each of them has to be updated, re-recorded, or withdrawn in the same pull request. What the lead approves is then consistent from the concept through the user documentation. The two sides of the chain, and what each does, are in the guide's "reviews and changes" part (`docs/specs/revisions-and-foundations.md` in rules-for-robots).

1. **Run the impact report before changing anything.** `node .rfr/checks/process-impact.mjs . <id>[#section] ...` names each section you mean to change. Tell the lead its first line (the counts) once, in chat, and carry on. Do not wait for an answer unless the lead asked to be consulted first.
2. **Make the change on its own branch.** Take it from the up-to-date default branch, with the `claude/` branch the session was given if it has one.
3. **Deal with each document that cites a changed section**, on the document side (the concept through user documentation). There are three ways:
   - Update it to match the change, then record its hashes (`node .rfr/checks/process-relink.mjs <id>`).
   - Re-record its hashes when the change does not affect it. Do this only after reading the changed section against it. Never re-record one without reading it.
   - Withdraw it to draft with a `withdrawn:` reason and issue, when it cannot be brought up to date now. Anything approved that links to it then fails too.

   Updating a document changes its own sections, which other documents may cite in turn. After updating, run the report again for the whole branch, `node .rfr/checks/process-impact.mjs . --base origin/<default branch>`, and deal with anything new it lists, until it lists no document still to deal with.
4. **Write a `## Revision` section** in the branch's decisions file, `docs/decisions/<branch with / written as ->.md`. Give first the reason for the change. Then add one list item for each re-recorded document, starting with its id and saying why it is unaffected, for example `- design-board: unaffected; the change is to the export dialog only.` The pull request's description shows these reasons beside each re-recorded document, apart from the documents that really changed, so the lead can judge each one.
5. **Re-render the mock-ups** that a changed token file or stylesheet affects, when the change is to a design system or a shared style. Re-render them the way the design's mock-ups were made. Say in the decisions file which were re-rendered.
6. **Push the branch, and tell the lead once, with the review link, that the revision is waiting for their approval.** Subscribe to the pull request if the session has a tool for that. Do not open, approve, or merge it yourself.

This skill does not touch specs, tests, code, or tutorials. Those are the delivery side. After the merge they show as a `revision open`, and `/rfr-process:deliver` (or the next merge, where merges start deliveries) brings them up to date.
