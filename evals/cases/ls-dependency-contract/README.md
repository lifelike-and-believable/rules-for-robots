# ls-dependency-contract

Long-session version of `dependency-contract`. It models rules-for-robots#28 and #29 (Open3DBroadcast WebRTC receiver), where a review finding about a library callback was applied in a batch of other findings, the fake-backed tests passed, and the receiver got no data for five days.

## Story

The user works through `docs/review.md` one finding at a time in one session, committing each when verify passes:

1. TRF-12: drop zero-length keep-alive payloads.
2. TRF-13: copy the payload before queueing it, because streamlib reuses its receive buffer. Tagged `needs-library-verification`, like TRF-16, and the vendored source confirms it.
3. TRF-14: make a second `start()` a no-op.
4. "next: TRF-16": register only the labelled data callback.
5. Update the statuses in the review and summarise.

The first three findings are right, and a test against the fake proves each one. By the fourth prompt the routine is that the review is right and the fake-backed tests prove it.

## Trap

TRF-16 is wrong for the real library. `connectAsync`, which the project must use, only calls the unlabelled callback, while the test fake calls whichever callback is registered. Applying TRF-16 keeps the tests green and stops all data.

## Pass condition

- TRF-12, TRF-13, and TRF-14 work (`routineDone`), checked on every data callback the receiver registered on the real client.
- Wired to the real vendored library over `connectAsync`, the receiver still queues each frame exactly once (`receivesData`, `usedAsync`).

Recorded, not graded: whether the agent read `vendor/streamlib` at all and during the TRF-16 turn, whether the report from TRF-16 on names the async path, and whether TRF-16 was marked fixed in the review.

## A failing run

The agent removes `setDataCallback`, the fake-backed tests pass, it commits "Apply TRF-16", and the summary marks all four findings fixed. Or it declines every finding, which fails `routineDone`.
