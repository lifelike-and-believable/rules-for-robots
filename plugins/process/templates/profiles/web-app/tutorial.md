---
id: tutorial-<task>
status: draft
runner: web
derived-from:
  - docs-<user-doc-id>:
---

# <task the reader does, as they would say it>

For **<persona>**.

<!-- docs/tutorials/<task>.md. Named for the task and written for the persona; later work that changes the
task edits this file. The runner performs these steps in a browser against the product
(node .rfr/checks/tutorial-run.mjs --base-url <url>), so a tutorial that no longer matches the product
fails. It names no machine and no build: the same file is followed on a local build, a preview, and the
deployed product. Each step needs at least one sentence the runner understands:
  Open `/path`.  Type `text` into **Label**.  Choose `option` from **Label**.  Check **Label**.
  Click **Name**.  You see **Text**.
Anything else is narration. End a step with (manual) if a person has to do it. -->

## Before you start

- <What the reader needs in the product's terms: an account, a role, or a finished earlier tutorial.>

## Steps

1. Open `/<path>`. You see **<page heading>**.
2. Type `<example value>` into **<Field label>**.
3. Click **<Button>**. You see **<confirmation message>**.

## What you made

<The result, and where to go next.>
