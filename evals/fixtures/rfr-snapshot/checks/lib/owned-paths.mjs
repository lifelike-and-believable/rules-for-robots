// Parser and matcher for the "## Owned paths" list in AGENTS.md (#47). The code lives in the
// rfr-core plugin, because the guard-owned-paths hook must work from an installed copy of the
// plugin alone; CI checks import it from here.
export { isOwned, parseOwnedPaths } from '../../plugins/core/scripts/owned-paths.mjs';
