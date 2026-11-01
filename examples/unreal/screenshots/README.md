# Approved screenshots

Reference images for the screenshot functional test in the Tier 2 workflow's `tutorial-demo` job (docs/specs/project-process.md, AC-25), one folder per engine version (`5.6/`, `5.7/`, `5.8/`). The job copies the folder for its engine version into the host project's `Test/Screenshots/` before the tests run.

A screenshot with no approved reference is reported as new. To approve one, download the `tutorial-demo-<version>` artifact from the run, check the image shows what the tutorial's step 3 promises (the display reads **Score: 3**), and commit it here under the same relative path the run reported. Approving a reference is a review decision, like approving an artifact: do it in a pull request the approver merges.
