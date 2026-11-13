# The project development process

Guide for the `rfr-process` plugin. It ships with the plugin, so the skills and agents can read it in any project. The design and the reasons behind it are in the rules-for-robots [spec](../../docs/specs/project-process.md); the mechanics (folders, front matter, CI jobs) are in the [README](README.md). This guide covers how to write each artifact well, what each review checks, and how to run a persona walkthrough. It is guidance, not rules: a stage gets its own skill only when an eval shows the skill does better than this page.

The process rests on two checks that people do and agents cannot: reading the user manual before the feature is built, and following the tutorials before the feature goes into production. Everything upstream exists to make those two reads meaningful, and everything downstream exists to make the product match what was read.

## Read the part for the work in hand

The guide is split by stage, so read only the part you need. Each part stands on its own.

| Part | Read it when |
|---|---|
| [Before you start](guide/start.md) | Before any work: what a change reopens, the repository, and choosing the size tier (fix and trivial changes are claimed in a commit). |
| [Design stages](guide/design.md) | Writing or reviewing the concept, discovery, requirements, personas, epics, stories, design, or user documentation. |
| [Delivery stages](guide/delivery.md) | Writing the technical specification, tests, and implementation. |
| [Validation stages](guide/validation.md) | Writing tutorials and demos, and releasing. |
| [Reviews and changes](guide/reviews-and-changes.md) | Running a persona walkthrough, turning a visual report into a test, handling a change to an approved artifact, or opening a pull request for an artifact. |
| [Adoption and tools](guide/adoption-and-tools.md) | Adopting the process on an existing project, and choosing or installing tools. |
