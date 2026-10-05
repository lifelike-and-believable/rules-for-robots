---
id: TEST-005
title: Model the real library's contract in test doubles
level: SHOULD
scope: core
paths: ["**/*.test.*", "**/*.spec.*", "**/test/**", "**/tests/**", "**/Tests/**", "**/fakes/**"]
verified-by: [review]
targets-failure: unverified-claim
observed-on: []
rationale: A fake that implemented an assumed contract kept tests green while the real library delivered no data (rules-for-robots#29).
sources: ["practices/testing-and-code-quality.md"]
---
A fake, stub, or mock of an external library is only as good as its model of that library. Model the behaviour the library actually has: which callbacks fire, on which path and thread, in what order, and on error. Cite the library source for each modelled behaviour. When tests pass against a fake, treat that as evidence about the fake, not the library.
