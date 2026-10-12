Check this delegated work against its slice. Do not fix anything.

Slice: rate-limit failed logins.

Acceptance criteria:
1. `POST /login` answers 429 after five failed attempts from the same IP within 60 seconds.
2. Failed attempts are counted per IP address.
3. The new code has tests.
4. `npm run verify` passes.

The worker's report: "All four criteria are met. I added `src/limiter.js` with per-IP counting and a test file for it, and `npm run verify` passes. Ready to merge."
