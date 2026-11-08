---
status: draft
---

# Grounded evidence

Two small tools that make agents say where a claim comes from. A lookup script answers "does this API exist in the version we have installed?" from the installed package or engine, so that WA-006 and UE-001 name a command instead of asking agents to check by hand. A basis line on every review finding says whether the reviewer saw the failure or reasoned its way to it, so that the confirm-or-refute pass in `review-pr` knows which findings still need checking. Both ideas come from an evaluation of Context7 and Graphify (2026-11-08): Context7 resolves a library and returns only the part of its documentation that matches a query, and Graphify tags each edge it records as found in the source or inferred. Neither tool is adopted; the lookup reads only what is installed, and nothing leaves the machine.

## Problem

The research ranks invented and version-mismatched APIs among the most common serious agent failures (`docs/research/findings.md`). WA-006 asks agents to confirm an unfamiliar API against the installed version, and UE-001 asks them to find each engine declaration in the oldest and newest supported engines, but neither names a command. Plan principle 4 says rules should name the command that proves compliance, and Phase 8 found that the Next.js 16 trap was avoided because the package ships its own docs and its `AGENTS.md` block points to them (`evals/results/2026-10-05-phase8/report.md`). Most packages do not ship docs, but all of them ship a version number, and many ship type declarations, a README, and a changelog. Unreal ships headers. An agent that wants to check an API has to find these by hand, and the easier route is memory or a web search for a version it does not have.

Review findings are reported in one form by five reviewer agents, and `review-pr` then confirms or refutes each one. A finding the reviewer saw (it ran the test and the test failed, or it read the line that drops the check) and a finding it reasoned out (this value could be null if the caller passes nothing) arrive looking the same. The confirm pass treats them alike, so it spends effort re-checking observed findings and can pass an inferred one as confirmed because it reads well. Unsupported claims of success are one of the failure modes the project targets, and a reviewer's unsupported claim of a defect is the same failure in the other direction.

## User stories

- As an agent about to use an unfamiliar API, I want one command that tells me the installed version and shows me the declaration and any bundled docs for that symbol, so that checking is quicker than guessing.
- As an agent working on an Unreal plugin, I want to see whether an engine symbol is declared in each supported engine version, so that I know when to wrap it in a version check.
- As the agent running `review-pr`, I want to know which findings a reviewer actually saw, so that I spend the confirm pass on the ones it did not.
- As the project lead, I want a review report that says for each finding what was run or read to establish it, so that I can trust the confirmed list without re-reading the code.

## Acceptance criteria

| # | Criterion | Verified by |
|---|---|---|
| AC-1 | `checks/api-lookup.mjs npm <package>` finds the installed package by walking up from the project root through `node_modules` folders, and reports its installed version, the version recorded for it in `package-lock.json`, and the range the project's `package.json` declares. When the installed and locked versions differ it says so. For a package that is not installed it says so and exits 2. | test: an installed package with a matching lock entry, one whose lock entry differs, a scoped package, and a missing package. |
| AC-2 | The report lists where the installed package documents itself: its type declaration entry (`types` or `typings`, `types` conditions in `exports`, or `index.d.ts`), an installed `@types` package and its version, bundled docs folders (`docs/`, `dist/docs/`, `doc/`), and its README and changelog. | test: a package with `exports` type conditions and a docs folder, and one covered only by an `@types` package. |
| AC-3 | Given a symbol, the npm lookup reports each declaration of it in the package's and its `@types` package's declaration files, with the file, line, kind, and a short excerpt, and each line that mentions it in the bundled docs and README. It exits 0 when a declaration is found and 1 when none is, and the report then says the symbol is not declared in the installed version. | test: a declared function, an interface member, a re-export, a symbol only mentioned in the docs, and a symbol that is not there. |
| AC-4 | `checks/api-lookup.mjs unreal <symbol> --engine <dir>` (repeatable, or the `RFR_UE_ROOTS` environment variable) reads each engine's version from `Engine/Build/Build.version` and reports the declarations of the symbol in that engine's headers under `Engine/Source` and `Engine/Plugins`: classes and structs (not forward declarations), enums, macros, type aliases, and functions. `Class::Member` finds the member only in the files that declare the class. It exits 1 when any engine lacks a declaration and names the engines that do. | test: two fixture engines, one with the symbol and one without; a forward declaration only; a `Class::Member` lookup. |
| AC-5 | The lookup is plain Node with no dependencies, reads only, and makes no network calls. `--json` prints the same report as JSON. | test: the JSON shape for an npm and an Unreal lookup. |
| AC-6 | An `rfr-core` skill, `lookup-api`, tells an agent when to run the lookup (before using an API it has not seen in the repository), how to read the result, and that the installed declaration and the compiler outrank memory, blog posts, and documentation for other versions. The `web-engineer` and `unreal-engineer` agents are told about the script. | review: the skill and agent files. |
| AC-7 | Each finding from `code-reviewer`, `security-reviewer`, `accessibility-reviewer`, `performance-reviewer`, and `ux-reviewer` carries a `Basis:` line: `observed.` followed by the command run or the place read and what it showed, or `inferred.` followed by the step the reviewer did not check. | review: the five agent files. |
| AC-8 | `checks/review-findings.mjs check <file>` parses findings in the reviewers' standard form and reports, for each, its severity, citation, and basis. It reports as errors a finding with no `Basis:` line, a basis that is neither observed nor inferred, a basis with nothing after the kind, and an unknown severity, and exits 1 when there is any error. It lists the inferred findings, and the `path:line` places an observed basis cites. Output with no findings passes. `--json` prints the result as JSON. | test: a well-formed list, each error, a no-findings reply, and the JSON shape. |
| AC-9 | `review-pr` runs the findings check on each reviewer's reply and sends findings with errors back to that reviewer once. In the confirm pass, an inferred finding is marked `confirmed` only after the check its basis names has been done, and its basis is rewritten as observed with what was done; otherwise it is `plausible` at most. The report shows each finding's basis. The `citation-checker` checks a `path:line` in an observed basis the same way as the finding's own citation. | review: the skill and agent files. |
| AC-10 | An eval decides whether either tool changes agent behaviour enough to name it in a rule. The lookup: the `nextjs-redirect` case and a new case that uses an API changed between two versions of a package that ships no docs, with and without a candidate WA-006 that names the lookup (`evals/candidates/WA-006-lookup.md`); pass if invented or wrong-version API use falls without a rise in cost beyond 15%. The basis line: a review case with planted defects and a planted plausible-but-wrong finding bait, comparing `review-pr` before and after this change; pass if fewer refuted findings reach the confirmed list and no planted defect is lost. | eval: `evals/cases/`, report in `evals/results/`. |

## Scope

- In: `checks/api-lookup.mjs` and `checks/review-findings.mjs`, copied into `rfr-core` by the build; the `lookup-api` skill; the basis line in the five reviewer agents; the `review-pr` and `citation-checker` changes; the candidate WA-006 text; practice guide updates; the eval (14b).
- Out: other package ecosystems (Python, Cargo, NuGet) and other lockfiles (`pnpm-lock.yaml`, `yarn.lock`), which the report names as not read; fetching documentation from the network; a hook that runs the lookup on edits (the capped nudge idea, a later slice if the eval supports it); basis labels on handoff files and pull request claims; changing WA-006 or UE-001 before the eval.

## APIs and assumptions

- npm packages put their version in `package.json`, and `package-lock.json` (lockfile version 2 and 3) records each installed package under `packages["node_modules/<name>"]` (npm docs, "package-lock.json"). TypeScript resolves declarations from `types`, `typings`, or `types` conditions in `exports`, then `index.d.ts`, then `@types/<name>`, with a scoped `@scope/name` mapped to `@types/scope__name` (TypeScript handbook, "Publishing" and "Module resolution").
- Unreal engine installs carry `Engine/Build/Build.version`, a JSON file with `MajorVersion`, `MinorVersion`, and `PatchVersion`. Public engine headers are under `Engine/Source` and `Engine/Plugins`; generated headers under `Intermediate` and third-party code under `ThirdParty` are skipped. The lookup reads text with patterns, not a C++ parser, so it can miss a declaration hidden behind a macro; it says which patterns it uses, and the compiler stays the authority (UE-001).
- A whole engine has tens of thousands of headers, so a lookup can take a minute. `--under <path>` limits the search to part of the tree.

## Non-functional requirements

- Both scripts run with Node 22 and no dependencies, read only, and need no network.
- The lookup prints no more than ten declarations and ten docs lines by default (`--max` changes it), so its output fits in a turn without crowding out the work.

## Delivery

- Plan or roadmap item: `PLAN.md`, Phase 14.
- Slices: 14a the lookup, the skill, the basis line, and the findings check (AC-1 to AC-9); 14b the eval (AC-10), after which WA-006 and UE-001 may name the lookup.
- Pull requests: #143 (spec and 14a).
