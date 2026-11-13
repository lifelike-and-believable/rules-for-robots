# Validation stages

Part of the [rfr-process guide](../GUIDE.md).

## Validation stages

### Tutorials and demos

A tutorial is user documentation that runs. It follows the user documentation step by step to a result the persona cares about, and it is the main expectation check: the approver follows it, and any gap between what users expect and what the product does shows up here, before production use.

- A tutorial is named for the task ("Give feedback and compare versions"), not for a feature, slice, or spec, and its file name says the same. It is written for the persona who does the task, and starts where that person starts, signed in to the product.
- "Before you start" lists only what the product asks of the reader: an account, a role, or a finished earlier tutorial. Steps name pages by path and controls by name.
- The same file is followed on a local build, a pull request's preview, and the deployed product, so it names no machine and no build: no address, no command that starts a server. How to get a place to try the product is described once for the project, outside the tutorials.
- The record of a run goes with the run (the recording and the pull request's description), never in the tutorial. A check only a person can do goes in the design's "Notes for delivery", and from there to the lead's validation.
- Later slices extend the tutorial for a task instead of adding one for each slice. A new tutorial is for a new task.

Every tutorial names its runner in front matter:

- `runner: web`: the steps run in a browser against the product (`node .rfr/checks/tutorial-run.mjs --base-url <url>`). Write each step with sentences the runner understands: ``Open `/path`.``, ``Type `text` into **Label**.``, ``Choose `option` from **Label**.``, `Check **Label**.`, `Click **Name**.`, and `You see **Text**.` Other sentences are narration. End a step with `(manual)` when a person has to do it. A tutorial that no longer matches the product fails, so the tutorial and the product cannot drift apart unnoticed.
- `runner: unreal`: an automation or functional test in the sample project follows the steps and names the tutorial's id in a comment. The process check fails if no test cites it, and the Tier 2 workflow runs the test on the engine runner. Record a short walkthrough video from the same steps for the Fab listing.
- `runner: manual`: a person follows it before each release. Use this only when neither runner can do the steps.

To run them against each pull request's preview deployment as well, copy `templates/workflows/rfr-tutorials-preview.yml`: it starts on a successful preview deployment, runs and records the web tutorials, and uploads the recording. A protected preview needs its bypass token as the `RFR_PREVIEW_BYPASS` secret, which is sent to the preview's own origin only.

**When the CI cannot drive the user interface** (a hosted CMS editor behind a login, a vendor's admin console): put the rules and messages the stories promise in a module that does not import the third-party tool, and unit-test that module against the criteria. The pilot covered 11 of 15 criteria this way. Cover the rest with a `runner: manual` tutorial that a person follows before release.

The pilot's manual pass then found four defects the tests had missed, all where the project's code called the framework: a validation result in a shape the framework ignored, a drop handler that left the framework's overlay stuck, a delete the framework refused, and a delete the editor pane never heard about. So:

- Wrap each call into the framework in a thin adapter, and test the adapter with a fake of the framework's interface (a fake validation rule, a fake document store), checking the shape the framework expects.
- List each framework behaviour the spec relies on under its assumptions ("Delete can be wrapped to run code afterwards"), so the build checks it early instead of discovering it.
- Test wiring by its observable effect ("removals are recorded"), not by the name of a planned function, so a change of mechanism does not unlock the test.
- Walk a manual tutorial once yourself before the pull request is ready, or say in the pull request that it has not been walked. The pilot's first manual tutorial had a step the framework refuses.

When tutorials follow fixture content and previews read a CMS that is still empty, a preview run fails for a reason that is not the product. Choose one: build previews with the fixture switch on (simplest; the preview then shows fixture content), give previews a seeded CMS dataset that matches the fixtures, or run the preview workflow only once real content exists.

A web tutorial runs in a laptop-sized browser unless its front matter names another size (`viewport: 390x844`); write a separate tutorial for each size whose steps differ. When a step clicks a control by its text, the runner uses the visible one, so a page may keep a hidden copy of a control for another screen size.

Run web tutorials in the project's own CI against a **fixture build**: the site built with fixed, offline content (for example an environment variable that swaps the CMS client for local fixtures), so each run is deterministic and does not depend on what the live content holds. A preview deployment is the second check, for what the fixtures cannot show.

The fixture build must cover **every** content source, not only the ones the current tests use, with a unit test that fails if any source still reads live content in that build (list the sources, and check each returns fixture data or nothing). In the pilot, five lists still read the live dataset; when the artist published their first art piece, three end-to-end tests failed on every branch, including `main`, for a reason unrelated to any change.

Review checks: the approver follows the tutorial on the real product. Did it produce what the stories promised? Was any step surprising?

### Release and feedback

Before a release, every story in it has an approved tutorial, and nothing it depends on is stale or withdrawn. Release notes are written from the user documentation, in the personas' terms. Feedback from real use is filed as an issue with the `feedback` label and routed to the artifact it affects: a wrong promise goes back to the story, a wrong flow to the design, a wrong explanation to the documentation.
