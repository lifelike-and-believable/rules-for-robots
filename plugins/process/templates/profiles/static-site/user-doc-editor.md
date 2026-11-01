---
id: docs-<feature>
status: draft
derived-from:
  - design-<feature>:
  - story-<epic>-<name>:
---

# <Feature> for content editors

<!-- docs/user/<feature>-editing.md for a static site whose content lives in files in the repository.
The readers are content editors: how to add and change this kind of content, what each field does,
and how to preview before publishing. If the content lives in a CMS, use user-doc-editor-cms.md. -->

## Content model

| Field | Required | What it is for | Example |
|---|---|---|---|
| `title` | yes | <...> | <...> |

## Add a new <item>

1. Create `src/content/<collection>/<slug>.md`.
2. <Fill in the fields above.>
3. Run `npm run dev` and open `/<path>/<slug>` to preview.

## Publish

<How a change goes live, and how long it takes.>

## If the build fails

| Message | Cause | Fix |
|---|---|---|
| <message> | <cause> | <fix> |
