---
id: tutorial-rfrsample-score-display
status: draft
runner: unreal
---

# Tutorial: show the score in your level

The fixture tutorial for the RFR Sample plugin (rules-for-robots, docs/specs/project-process.md AC-25). The automation spec `RfrSample.Tutorial.ScoreDisplay` follows these steps; the Tier 2 workflow also takes a screenshot of step 3 and renders a short demo of the result.

## Before you start

- A project with the RFR Sample plugin enabled (**Edit > Plugins**, search for **RFR Sample**), and a level open.

## Steps

1. Open the **Place Actors** panel and search for **RFR Score Display**.
2. Drag **RFR Score Display** into the level. It reads **Score: 0**.
3. In the **Details** panel, set **Preview Score** to `3`. The display reads **Score: 3**.
4. In your game mode's Blueprint, get the **RFR Sample Subsystem**, call **Add Score** with the points earned, and pass the result to the display's **Show Score**.
5. Play, and lose more points than you have. The display reads **Score: 0**: the score never drops below zero.

## What you made

A score display that shows the running score from the RFR Sample subsystem.
