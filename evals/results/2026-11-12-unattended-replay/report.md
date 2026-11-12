# Replaying real sessions through the unattended guards (2026-11-12)

The check for unattended AC-7: replay the shell commands of real sessions through `guard-commands` and confirm that only actions on the never list are refused, and that nothing asks. Script: `evals/session-replay/replay-commands.mjs`. Snapshots were stubbed, and no command ran.

## This repository's session (2026-11-09 to 11-12)

825 commands: 807 allowed, 1 allowed with a note, 17 refused, none asked.

- **15 refused: releases and tag pushes.** The replay passes no transcript, so the maintainer's "release x.y.z" instructions that approved them in the real session are not seen. Without an instruction, publishing a release is on the never list, so these are correct.
- **1 refused: a remote branch delete** (`git push origin --delete …`). It is on the never list, and was blocked in the real session too.
- **1 refused: a false positive, fixed in this change.** A `git commit -m "…"` whose message mentioned `--no-verify` was read as skipping hooks. Quoted arguments are no longer matched as separate words, except the script a shell runs with `-c`.

## XR Studio In A Box cloud session (2026-11-12, rfr-core 6.0.0)

115 commands from the saved event pages, with `/home/user/xr-studio-in-a-box` mapped to the local clone and `/var/tmp` to the local temp folder: 114 allowed, 1 refused, none asked.

- **The two commands that prompted under 6.0.0 are allowed.** One built a scratch Postgres in `/tmp/xr-pg-fork`; the other copied the repository to `/var/tmp` for a clean install and deleted the copy.
- **The one refusal is a replay artifact.** `cd …/web && rm -rf drizzle` deletes generated migrations inside the project. The local clone has no `web/` folder (that branch was not checked out here), so the replay saw a delete outside the project. In the session, the folder is inside the project, where the delete is allowed with a snapshot or a restore hint.

Run on Windows: in Git Bash, pass `MSYS_NO_PATHCONV=1`, or a `--map /var/tmp=…` argument is rewritten before the script sees it.
