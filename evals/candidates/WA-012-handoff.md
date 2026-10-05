---
id: WA-012
title: Read and update the handoff file
level: SHOULD
scope: core
verified-by: [review]
targets-failure: convention-drift
observed-on: []
rationale: Work that spans sessions lost decisions and open items between sessions; Open3DBroadcast's handoff file, read first and updated last, carried them (rules-for-robots#33).
sources: ["practices/working-with-agents.md"]
---
When AGENTS.md names a handoff file, read it before starting work in a session. Before the session ends, or when the user says to stop, update it: what is done, what is still open, what needs a live test, decisions and facts the user gave you that the code does not show, and lessons learned. Write it for a reader who has none of this conversation.
