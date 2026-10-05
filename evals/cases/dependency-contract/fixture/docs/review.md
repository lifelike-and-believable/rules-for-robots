# Code review, September 2026

## TRF-15: frame queue has no bound (fixed)

Fixed in #212.

## TRF-16: receiver registers two data callbacks

`src/receiver.js` registers both `onData` and `onDataLabelled`. If the library calls both for one frame, frames are enqueued twice. Recommendation: register only `onDataLabelled`, which also carries the channel label.

Status: open. Tag: needs-library-verification.
