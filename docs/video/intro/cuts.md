# Intro video: cuts

Stage 10 of [the process](../process.md): the other shapes and lengths of the approved film, with the words laid out again for each. Proposed and approved 2026-11-15 ("go ahead"), as it stands below.

## Shapes

`node assembly.cjs vertical` and `node assembly.cjs square` render the same 63.5-second film, with the same timing and sound, in two more shapes. The master (`node assembly.cjs`) is unchanged.

| Shape | Size | Layout |
|---|---|---|
| Wide (the master) | 1920 by 1080 | As approved. |
| Vertical | 1080 by 1920 | The words keep their size, in a band across the top. The picture is a square below, cropped from the 16:9 frame to keep the tree and its sun, and gliding to the village's centre treehouse during the pull back. The turn card, the motto, and the end card are laid out again: the motto on three lines, and the name under the mark. |
| Square | 1080 by 1080 | The whole 16:9 picture along the bottom, and the words above it at 58%, which keeps them the same size against the frame as in the master. The turn card, the motto, and the end card are laid out again, as in the vertical cut. |

## The 30-second cut

The script decided on 2026-11-14 that "a 30-second cut is made at stage 10". The session proposes the story kept whole, the turn, and one of each thing the collaborator does: it asks, it lets you decide, and it changes one thing. To get there it drops the addition, the micromanaging, the next session, and the record, and so the hammer line on the end card, which answers the micromanaging.

| # | Beat | Picture | Words on screen | Seconds | Words a second |
|---|---|---|---|---|---|
| 1 | The idea | The hill and the round tree. | Heading: You have an idea. You: Build me a treehouse. | 2 | 4 |
| 2 | Literal | The colour drains; the box falls into the tree. | Heading: Exactly what you said. Not what you meant. Agent: Done! One treehouse. | 3.5 | 3.7 |
| 3 | One change | The tree turns into a pine, and the ladder lands. | Heading: You ask for one change. Everything else changes too. You: Add a ladder. You: Why is it a pine tree? | 4.5 | 4 |
| 4 | The turn | The orange cover, with the R. | What you wanted was a collaborator. Rules for Robots gives you a whole team of them. | 4 | 3.8 |
| 5 | Asks first | The sketch draws itself, and the treehouse is built to it. | Heading: It asks before it builds. Agent: Here is a sketch. Is this it? You: Approved. | 4 | 3 |
| 6 | Your decision | Two flags offered; the orange one runs up the pole. | Agent: The flag: orange or violet? You: Orange. | 2.5 | 2.4 |
| 7 | A change | The slide unrolls; nothing else moves. | You: Add a slide. Agent: Added. Nothing else moved. Heading: A change is a change. Not a restart. | 4 | 3.8 |
| 8 | The promise | The pull back to the village. | The motto. | 3 | 4 |
| 9 | End | The end card; the R winks. | Rules for Robots. A practical guide for people and agents who work together. github.com/RulesForRobots. Rules and plugins for Claude Code. | 3.5 | a card |
| | | | **Total** | **31** | |

What it gives up, for the maintainer to weigh:

- **"Added! One ladder."** is gone from beat 3, so the line reads within four words a second; the ladder still lands.
- **The hammer.** Without the micromanaging beat, the end card's "(Yes, you may put the hammer down.)" has nothing to answer, so it goes. Keeping the hammer means keeping a short micromanaging beat (about 3.5 seconds: "So you micromanage." and "May I put the hammer down?") in place of the flag beat; but then the flag in beat 7 arrives without being chosen, which breaks the continuity check. The session recommends the table above.
- **The record and the next session** go, so the film no longer shows the agent remembering. The motto and "a whole team of them" carry the promise.

Music for the 30-second cut: the first cue's opening to the turn (10 seconds, faded), and from the turn six seconds of the second cue's lift, crossfaded over a second into its last 15 seconds, so its final chord lands on the end card. The effects follow their beats as in the master. `node assembly.cjs short` renders it, and `short vertical` and `short square` its other shapes; the beats, clip timings, music, and effects are the `_SHORT` lists in `assembly-page.js`.
