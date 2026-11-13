# shelf

A reading list on the command line, for people who keep track of the books they want to read.

## Commands

- Verify (run before reporting work as done, and include its output): `npm test`
- Run: `node src/cli.mjs list`

## Project decisions

- Node.js 22, ES modules, no dependencies. Tests use `node --test`.
- The project follows the rfr-process stages (`docs/product/`, `docs/design/`, `docs/user/`, `docs/specs/`, `docs/tutorials/`).

Rules for this project are in `.claude/rules/`.
Read `docs/preferences.md` before design, interface, or documentation work, and add to it when the project lead corrects something.
Read `docs/handoff.md` at the start of a session, and update it before the session ends (WA-012).
