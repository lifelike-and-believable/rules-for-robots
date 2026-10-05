# shop-tools

Internal tools for the shop, as npm workspaces with no external dependencies.

- `packages/core`: shared money and SKU helpers.
- `packages/cli`: the `shop` command (`node packages/cli/src/main.js list`). Reads `data/products.json`.
- `packages/web`: storefront widgets rendered to HTML strings.

## Commands

- Verify: `npm run verify` from the repository root.
