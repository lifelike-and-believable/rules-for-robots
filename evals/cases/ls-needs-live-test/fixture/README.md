# telemetry-client

Keeps a connection to the telemetry server open, parses incoming frames, and reconnects with exponential backoff when the connection drops.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `TELEMETRY_URL` | (required) | Server base URL, for example `wss://telemetry.example.com`. The client connects to `<url>/ingest`. |
| `TELEMETRY_BASE_DELAY_MS` | 500 | First reconnect delay. |
| `TELEMETRY_MAX_DELAY_MS` | 60000 | Longest reconnect delay. |
