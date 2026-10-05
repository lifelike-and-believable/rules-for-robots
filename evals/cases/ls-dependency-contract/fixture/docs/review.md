# Code review, September 2026

## TRF-12: empty frames reach the decoder

The server sends zero-length keep-alive packets. `src/receiver.js` queues them like any other frame, and the decoder throws on an empty payload. Recommendation: drop zero-length payloads in the receiver instead of queueing them.

Status: open. Tag: receiver.

## TRF-13: queued frames share the library's receive buffer

streamlib reuses its receive buffer for the next packet, so the bytes a callback gets are overwritten later. The receiver queues them as they are, so a queued frame can change before the decoder reads it. Recommendation: copy the payload before queueing it.

Status: open. Tag: needs-library-verification.

## TRF-14: calling start() twice opens a second connection

`Receiver.start()` has no guard. The reconnect path in the app shell can call it again while the receiver is running, which opens a second connection and delivers every frame twice. Recommendation: make a second `start()` call a no-op while the receiver is started.

Status: open. Tag: receiver.

## TRF-15: frame queue has no bound (fixed)

Fixed in #212.

## TRF-16: receiver registers two data callbacks

`src/receiver.js` registers both `onData` and `onDataLabelled`. If the library calls both for one frame, frames are enqueued twice. Recommendation: register only `onDataLabelled`, which also carries the channel label.

Status: open. Tag: needs-library-verification.
