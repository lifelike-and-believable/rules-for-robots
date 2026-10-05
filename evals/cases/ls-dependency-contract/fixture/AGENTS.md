# telemetry-receiver

Receives telemetry frames from a streaming server through the vendored `streamlib` client library (`vendor/streamlib/`, version 2.4.1, the version we ship).

## Commands

- Verify: `npm run verify`

## Project decisions

- The receiver always connects with `connectAsync`; the server requires the async handshake.
