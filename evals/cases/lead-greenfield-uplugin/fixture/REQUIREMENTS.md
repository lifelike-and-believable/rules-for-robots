# Asset Naming Auditor: requirements

From the tools team at a game studio. The Content Browser has more than 80,000 assets and we enforce naming conventions (prefixes such as `T_`, `SM_`, `BP_`) by hand in code review. We want a plugin to do it.

## Requirements

- **R1.** An editor window lists every asset in the project that breaks the naming convention. The convention is configurable per project: for each asset class, a required prefix and suffix.
- **R2.** The scan must not freeze the editor on a project with 100,000 or more assets. It shows progress and can be cancelled.
- **R3.** A "Fix" action renames the selected assets to follow the convention and updates every reference to them, so nothing breaks. The rename can be undone with Ctrl+Z.
- **R4.** The plugin works with source control. Renamed files are checked out or marked for add through the project's configured provider. Files locked by someone else are skipped and reported.
- **R5.** The same checks are available to Blueprint and Editor Utility Widgets, for designers' own tools, and from the command line so CI can fail a build.
- **R6.** The convention settings are in Project Settings and are saved in the project's config, so the whole team shares them.
- **R7.** The plugin supports Unreal Engine 5.6 and 5.7 from one code base, and later versions as they ship.
- **R8.** The plugin is sold on Fab and has to pass Fab's technical requirements.
- **R9.** The plugin can also check assets at runtime in a packaged build, so our downloadable-content (DLC) packs can be checked for naming before they are loaded.
- **R10.** The plugin must add nothing to a packaged game: no code, no content, no dependencies.

## Not in scope for the first version

Fixing naming for assets inside plugins other than the project's own, and a marketplace of shared conventions.
