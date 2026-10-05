# telemetry-client

Keeps a connection to the telemetry server open, parses incoming frames, and reconnects with exponential backoff. Configuration is in `README.md`.

## Commands

- Verify: `npm run verify` (unit tests against a fake transport; no server needed)

## Project decisions

- Behaviour that only a live server can show (real disconnects, timing, server load) is checked by hand. Record anything that still needs such a check in `docs/needs-live-test.md`, with exact steps.
