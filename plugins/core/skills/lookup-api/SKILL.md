---
name: lookup-api
description: Check that a library, framework, or Unreal Engine API exists in the version installed in this project, by reading the installed package's version, lock entry, type declarations, and bundled docs, or the engine headers of each supported engine version. Use before using an API you have not seen in this repository, when a compiler or type error suggests a version mismatch, or when the user asks whether an API is available.
argument-hint: "npm <package> [symbol] | unreal <Symbol or Class::Member>"
---

# Look up an API in the installed version

`<api-lookup.mjs>` below is `${CLAUDE_SKILL_DIR}/../../scripts/api-lookup.mjs`. It has no dependencies, reads only, and makes no network requests. When you delegate implementation to the `web-engineer` or `unreal-engineer` agent, give it this path; subagents cannot run skills.

1. **Run the lookup** from the project root.
   - npm: `node <api-lookup.mjs> npm <package> [symbol]`. A member is `Type.member`; the lookup searches for its last part.
   - Unreal: `node <api-lookup.mjs> unreal <Symbol> --engine <oldest engine dir> --engine <newest engine dir>`, or set `RFR_UE_ROOTS` to the engine folders separated by the platform's path separator. Use the oldest and newest versions AGENTS.md lists. `Class::Member` finds the member only in files that declare the class. A whole engine takes up to a minute; `--under Runtime/Engine` narrows it.
   - `--max <n>` shows more than ten results; `--json` prints the report as JSON.
2. **Read the result.**
   - Exit 0: the symbol is declared. Use the declaration's signature as shown, not the one you remember.
   - Exit 1: not declared in the installed version (or, for Unreal, in at least one engine; the report names which). Do not use it from memory. Look for the replacement in the package's changelog or the bundled docs lines the report lists, or, for Unreal, wrap it in an `ENGINE_MAJOR_VERSION` / `ENGINE_MINOR_VERSION` check or a small wrapper (UE-001).
   - Exit 2: the package is not installed, or no engine was given. Say so; do not install a package to look it up without asking (CODE-004).
   - When the installed version differs from the lock entry, the install is out of date: say so, and ask before reinstalling.
   - A package that ships no declaration files cannot be checked this way. Read its source in `node_modules/<package>/` or its bundled docs instead.
3. **Weigh it.** The installed declaration and the compiler outrank memory, blog posts, forum answers, and documentation for other versions, which are leads at best (WA-006). The Unreal lookup matches text patterns, so a declaration behind a macro can be missed; a compile against each supported engine settles it.
4. **Report** what you looked up, the version the report found, and what you did with the answer, so the next reader can see the API was checked.
