# Intro video

A promotional film for Rules for Robots, about a minute long, for the homepage and later for social feeds. It is work in progress, and the first full trial of a process for content. This file is the record a new session needs to carry on.

## Brief

- **For:** someone who already works with agents and has met these troubles.
- **Says:** why Rules for Robots exists, as it happened to its author, and what working with a collaborator is like instead.
- **Must work with the sound off.** It will usually play muted on a homepage, so every word is on screen. Sound is a later layer for social versions.
- **Form:** animation and motion graphics. Deliver 16:9 at 1920 by 1080, with shorter and vertical cuts later.
- **Look:** the brand in `docs/brand/`. The only robot is the R.

## Story

The maintainer's account, in order. What you have in mind never changes; what comes back does.

| Beat | You say | What comes back | The agent says |
|---|---|---|---|
| An idea | "Build me a treehouse." | | |
| Literal | | A box wedged in a tree, with no way up | "Done! One treehouse." |
| One change | "Add a ladder." | A ladder, but now it is a pine tree and the house has moved | "Added! Plus a few improvements." |
| An addition | "And a slide." | The slide goes through the ladder | "Added!" |
| Rules | Notes: "KEEP THE TREE." | Questions about a hammer | "May I put the hammer down?" |
| Next morning | | The same mess | "Hi! Nice slide tower. Shall I remove the tree?" |
| The turn | | The orange cover | "What you wanted was a collaborator." |
| Asks first | "My kids. They love to climb." | A sketch to approve | "Before I build: who is it for?" |
| Your decision | "Orange." | Two flags | "The flag: orange or violet?" |
| The record | | Decisions, each with its reason | "Noted, so the next session knows too." |
| A change | "Add a slide." | A slide, and nothing else moved | "Added. Nothing else moved." |
| The promise | | A village of treehouses | "Bigger projects. Longer projects. Built the way you meant." |
| End | | The name, the volumes, where to find it | "(Yes, you may put the hammer down.)" |

## Decisions so far

Each was the maintainer's, on 2026-11-14, from options shown on a review page.

1. The story is the origin of Rules for Robots, not command prompts alone. Prompts appear in the middle, as the result of trying to control the outcome.
2. It is an advertisement: fun, and about the promise of productivity and creative freedom.
3. Animation and motion graphics, silent first.
4. A treehouse, because a house and a boat were dull and swapping one for the other was a straw man. Each trouble is one an agent really causes.
5. The look should aim at current agency work: scenes that fill the frame, no diagram layout, the idea as a blueprint outline that what is built either misses or fits.

6. The look is take vector B (see "Illustration test takes"). The maintainer first asked for vector A with more of B's shapes, saw the four frames redrawn that way by code, and did not like them: "I think the style of vector B is my favourite." What makes B is its hand-drawn shapes and printed texture, which geometric code does not reproduce, so the film uses B's own artwork where it can.

Not yet decided: how the scenes B does not show (the trouble half, the sketch, the village) are made in its style; length (the proxy runs 66 seconds, and about 45 is the aim); sound.

## Files

| File | What it is |
|---|---|
| `animatic.html` | The proxy from before the look was chosen: the whole film at sketch quality, playable in a browser. `film-page.js` has replaced it as the source of the timing and the words. |
| `motion/`, `motion/cuts.json`, `motion.cjs` | Stage 6: every motion take, the chosen take of each change with the frames the film uses, and the script that strings them into `out/motion-reel.mp4`. |
| `frames.cjs` | Renders the animatic. `node frames.cjs sheet` writes one frame for each beat; `node frames.cjs render 20` writes every frame at 20 a second, for ffmpeg to encode. |
| `art.cjs` | Builds the style frames as SVG from the takes and the words. `node art.cjs` writes them to `style/`. |
| `kit.cjs` | Reads the takes: vector B with and without its slide, the idea's outline, and any other take as a scene. |
| `film.cjs` | Renders the film to `out/intro.mp4`: the pictures once as layers, then every frame, then ffmpeg. `node film.cjs sheet` writes two frames of each beat to `out/sheet/` in a few seconds, to check a change. |
| `film-page.js` | The film as a function of time, run in the page `film.cjs` builds. The timing and every word are in its `BEATS` array. It repeats the bubble and mark drawing from `art.cjs`. |
| `stylepng.cjs` | Renders the style frames to PNG at 1920 by 1080. |
| `style/` | The style frames. |
| `takes/` | Every generated take, as downloaded: the illustration test and the scenes. |

The scripts end in `.cjs` because this repository's `package.json` makes `.js` files ES modules. They need Playwright with its Chromium, and ffmpeg, which this repository does not install. The animatic and the frames use Space Grotesk from Google Fonts.

## Next

**Stage 6, motion: the clips.** On 2026-11-15 the maintainer approved the rest of the motion on `minimax_h3` ("go ahead"), within about 210 credits. Each of the eight remaining changes was made twice, 5 seconds at 16:9, with its two approved design pictures as first and last frame by job ID. All sixteen jobs finished; the session chose one take for each change from contact sheets and larger frames of the busiest moments, and needed no retakes. `out/motion-reel.mp4` (not committed) strings the chosen takes in story order with a label on each. The maintainer approved them apart from the bounce in the two slide clips, which is now cut (below); the cut waits for the maintainer's look.

| Change | Beat | Take A | Take B | Chosen, and why |
|---|---|---|---|---|
| The box drops into the tree | 2 | `02-box-a.mp4`, `b2c27e52-12a7-4567-83df-e6ef992d4f6c` | `02-box-b.mp4`, `3f32bb90-19a3-496f-8eea-5f206ad88c78` | A: it falls from the sky and bounces; B appears inside the tree. |
| The round tree becomes a pine | 3 | `03-pine-minimax-a.mp4` (the test) | `03-pine-minimax-b.mp4` | A, from the test. |
| The slide lands on the ladder | 4 | `04-slide-on-ladder-a.mp4`, `7d6d46b4-c80f-45e9-8d6e-e04de60ebea5` | `04-slide-on-ladder-b.mp4`, `78be9302-dac3-4bbf-8159-60069b49c3ca` | A: a smoother slide out of the box; both usable. |
| The second box | 6 | `05-second-box-a.mp4`, `01b28a9a-4de8-405f-9557-576238436eb7` | `05-second-box-b.mp4`, `243e9bb9-2b54-4f96-89a3-a33b681507a0` | A: it pops in large and settles to size; B just appears. |
| The sketch draws itself | 8 | `06-sketch-a.mp4`, `e65f2ad9-4f94-4ca0-8446-b6b643b88a09` | `06-sketch-b.mp4`, `f8ca9467-06d3-43a1-9279-6b058d94ffdb` | A: deck, railing, cabin, roof, window, ladder, then the pole, as asked; B draws the pole before the ladder. |
| The sketch is built | 8 | `07-build-a.mp4`, `857c4ddc-aa2c-4859-b528-b3422b2b2107` | `07-build-b.mp4`, `e61ae085-9165-4e9d-a4ad-c0b1938b616d` | B: A darkens the canopy behind the sketch before anything is built. |
| The flag goes up | 9 | `08-flag-a.mp4`, `c8e135d3-81f5-41d0-9190-b86a167fc2f9` | `08-flag-b.mp4`, `1dad5142-e85a-4f7a-b4ef-74e6b27b83af` | A; the two are almost the same. |
| The slide unrolls | 11 | `09-slide-a.mp4`, `62e42d75-956b-45bd-8a80-1eda4c33340d` | `09-slide-b.mp4`, `45a94d79-2c99-48a3-b21a-463892365fae` | A: it rolls out of the railing opening as a tube and unrolls to the grass; B starts as a stub and grows. |
| The pull back to the village | 12 | `10-village-a.mp4`, `3dc33486-66db-425e-90d4-c21c0ac66970` | `10-village-b.mp4`, `fd9e1a09-5df6-4c76-af61-b4100b0f532b` | B: A runs rope bridges into empty sky before the neighbouring trees arrive. |

The maintainer's note on the reel, 2026-11-15: "the bounce that happens after the slide extends/unfurls in both scenes is unnecessary and distracting. everything else is good". The bounce was in the session's prompts ("bounces once as it lands", "settles with a small bounce"). Both slides first land where they finally rest, so each clip now skips its bounce in place of a retake: it plays to the landing, holds that frame for a quarter second, and dissolves into the frames after the bounce, where beat 11's flag is still moving. The frames each clip uses are in `motion/cuts.json`, which assembly reads too; `node motion.cjs` builds the reel from it. Lesson for the process: ask for the motion the picture needs and no flourish beyond it, because a model takes every word of a prompt as something to show.

Each clip is 5.17 seconds at 2560 by 1440 and cost 10 credits: 160 for the stage, 486 for the film so far, 439 left on the account. Every clip holds still around its change and keeps the flat style. Assembly will cut each clip to its beat's length and may hold or speed it; the clips are longer than most of the changes need.

**Stage 6, motion: the test.** The maintainer approved the animatic on 2026-11-15 ("those are all fine"). One change, beat 3's round tree becoming the pine as the box moves and the ladder lands, was made between design pictures 02 and 03 (as first and last frame, by their job IDs) on both video models. Quotes: 8 credits for 4 seconds on `minimax_h3`, 40 for 5 seconds at 1080p on `flux_3_video`.

| File | Model | Job | Result |
|---|---|---|---|
| `motion/03-pine-flux-a.mp4` | `flux_3_video`, 5 s, 1080p | `6f6ad487-a065-4c72-ae2d-faa2acb99768` | The box flies out and lands, the ladder tumbles in; the tree swaps almost as a cut. 40 credits. |
| `motion/03-pine-minimax-a.mp4` | `minimax_h3`, 5 s, 2560 by 1440 | `fa5b6dbd-dc86-4cbd-aa48-e02425367641` | The round tree visibly folds into the pine, the box tumbles down, the ladder swings up into place. 10 credits. |
| `motion/03-pine-minimax-b.mp4` | `minimax_h3`, 5 s, 2560 by 1440 | `48c80651-2050-4a1a-a630-50aac2a4d67c` | A quicker change; the box tumbles, the ladder flies in. 10 credits. |

Two earlier takes on `minimax_h3` at 4 seconds (`28a0eb2b-574e-49fc-8d02-3af6af12da5a`, `da1a5725-7783-48c7-bad2-fe5e2152041e`) failed on Higgsfield's side and were not charged. The test cost 60 credits; 326 have been spent on the film. Both models kept the world still and the style flat. The session recommends `minimax_h3` for the motion stage: take A shows the morph the review asked for, it renders at a higher resolution, and it costs a quarter as much.

**Stage 5, the animatic.** `node animatic.cjs` renders `out/animatic.mp4` (64.5 seconds) from the approved pictures in `design/` and the approved script, with cuts, dissolves, and wipes only; `node animatic.cjs sheet` writes two frames of each beat. The timing and every word are in `animatic-page.js`. The ash of beats 2 to 6 is made by ffmpeg, and the slide is kept in colour by a mask cut by its colour; the slide's darker rim falls outside that mask and shows grey, which the finals should fix with a proper mask. `film.cjs`, `film-page.js`, `art.cjs`, `kit.cjs`, and `style/` are the trial's, kept as its record.

An independent review of the first animatic (2026-11-15) passed the story and found: last lines held under a second and a half in beats 1, 2, 4, 6, and 11; the second box with no moment of its own; words touching the pictures in beats 3 and 10; the end card off centre with a small plain line; the village's centre treehouse different from beat 11 and its sun gone; a tone shift around the slide in beat 11; the offered flags left on screen; and the bad agent's two-dot face as a second robot. All are fixed in the second animatic: the lines come sooner, the box arrives on "The treehouse.", the Noted line runs to two lines, the slide in beat 11 is the pixels where 09 differs from 08 laid over 08, the bad agent is a plain grey square, and the village is rebuilt. The review's list of what generated motion must do for each change is the brief for stage 6. Still open from it: the grey box in beat 2 is hard to see on the grey tree, and beat 5 mocks asking three beats before beat 8 praises it.

**The motto.** On 2026-11-14 the maintainer said the film's promise line "should emerge as the Rules for Robots motto". The social preview keeps "A practical guide for agent collaborators" under the name for now, at the maintainer's word: "It makes it a bit clearer on the landing page what it is." The motto is the film's, and the end card's.

**From 2026-11-14 the film follows [the process](../process.md), one approved stage at a time.** The maintainer asked to "back up and do the professional process" in place of rendering the film again after each change. Where it stands: the brief is above; the script is drafted in [`script.md`](script.md) and waits for the maintainer; the look (vector B) and the village's five designs are approved in concept; design, the animatic, motion, sound, and the cuts follow in order. The six cuts so far are the trial that the process was written from, and the list below is its record.

1. **The illustration test.** Run on 2026-11-14 for 36 of the approved 100 Higgsfield credits; the takes are listed under "Illustration test takes" below and wait for the maintainer to compare them with `style/3-fit.svg`. The tracing step has not been tried, and is only needed if a `standard` take is chosen. Recipe: model Recraft V4.1; aspect 16:9; resolution 2k; two variants with `model_type` `vector` and two with `standard`; colours `#FFF4E6 #2A1A14 #E4572E #B8401D #2563C4 #7A45C9 #0E8A72 #0B6E5B #F9C9B2`; prompt:

   > Flat vector editorial illustration for a motion-graphics explainer film. A charming children's treehouse in a large round leafy tree on a gentle grassy hill: wooden deck with a railing, a small blue cabin with a violet pitched roof, a round glowing window, a small door, an orange pennant flag on the roof, a wooden ladder on the left, and a bright orange slide curving down on the right. Warm cream sky, a large orange sun, layered mint-green hills behind, small flowers in the grass. Bold simple shapes with hand-made character, subtle grain texture, soft shadows, no outlines, no people, no text, no lettering. The tree sits right of centre with empty sky on the left.

   Get the cost first, keep every take, and compare the results with `style/3-fit.svg`. If the generated look is better, try tracing one to vector layers with the Adobe vectorize tool.
2. **The look.** Done. The maintainer chose it (decision 6) and approved the eight style frames in `style/` on 2026-11-14.
3. **Production.** A sixth cut exists: `node film.cjs` renders `out/intro.mp4`, 54 seconds at 1920 by 1080 and 24 frames a second, silent, in about two minutes. It has thirteen beats, with the timing and every word in the `BEATS` array of `film-page.js`. `out/` is not committed. Still to do: the maintainer's view of the fifth cut and of what is left under "Review of the second cut"; sound; the shorter and vertical cuts.

## Review of the second cut

On 2026-11-14 the maintainer asked for an independent creative review. A fresh agent was given the film, the brief, and the story, and no opinion of the work. Its verdict: the second half sells, the first half is muddled, and the film plays as a captioned slideshow.

Fixed in the third cut:

- The rules beat was unreadable (about 35 words in 4.6 seconds). It now runs 6.4 seconds with two notes, and its three questions are at full contrast.
- The record beat was too dense. It now runs 4 seconds with two decisions and larger reasons.
- Headings ran into the pictures. The trouble headings are smaller.
- The blue outline hid the joke of the box with no way up, because its ladder was drawn over the tree. The outline is bright while it is alone and steps back once a picture is over it.
- Pictures arrived as dissolves that looked like double exposures. They now wipe in, and the village builds up from the ground as the treehouse does.
- The finished treehouse appeared and was gone. It now holds a second longer.
- Dashes stayed on the finished artwork. The sketch now fades once the thing is built, and the slide's sketch appears and goes the same way.
- One still picture held for eleven seconds. Night now falls at the end of the rules beat and lifts on the next morning.
- The end card was lopsided and its address small. It is centred, the address is larger, and the last line has more time.
- The first frame was blank. It now carries the first heading.
- The village: every treehouse has a ladder to the ground, the flagpoles reach the roofs, and the slide is redrawn in two tones down to the bushes.

Done in the fourth cut, after the maintainer asked why the fixes that touch the story or need new artwork were being held back:

- **The film mocked "So you write rules", and never said what the thing is.** The end card now says "Rules and plugins for Claude Code. They teach it what to ask you, and what to just do." The words are the session's and the maintainer has not yet read them.
- **The slide through the ladder did not read, and the pine tree changed between two beats.** Both beats now use one take. `kit.cjs` paints the slide's shape the colour of the foliage for the earlier picture, and leaves the slide in orange in the ash picture for the later one.
- **The village was off-model, and a slide the session drew over it looked childish** (the maintainer's word). It is replaced by a new take, `scene-village-c`: ladders to the ground, wavy orange flags on the roofs, bridges from deck to deck, a slide that lands on the grass.

Done in the fifth cut, from the maintainer's notes on the fourth ("I agree with most of the reviewer's comments"):

- **The flag was already orange when its colour was asked for.** The pole now stands bare from the moment the treehouse is built; the orange flag goes up after "Orange." `kit.cjs` paints the flag's tile the colour of the foliage for the bare pictures, and the flag is its own layer.
- **Nothing moved inside a scene.** The flag now moves in the wind for as long as it is up.

Still open:

1. The film is 9 seconds over the 45 that was the aim. The review asked for more time in the dense beats, not less overall.
2. The treehouse from the film is not in the village.
3. Smaller: bubble text that is marginal when embedded small; the long "Noted" bubble over the foliage; whether "It asks you what only you can decide" should come before "It asks before it builds".

What the review said to keep: the switch from ash to colour at the turn, the cover wipe, the fixed outline as what you had in mind, the two faces and bubble colours, the lines "Added! Plus a few improvements." and "Shall I remove the tree?", and the change beat.

## Illustration test takes

Generated on 2026-11-14 with the recipe above (model ID `recraft_v4_1`). The cost was quoted first: 20 credits for the two `vector` takes and 16 for the two `standard` takes. All four are kept in the maintainer's Higgsfield account. Every address starts with `https://d8j0ntlcm91z4.cloudfront.net/user_3FflbWuJ9ah9kIXSyBa65xCGYiy/`.

| Take | Type | Output | Job ID | File |
|---|---|---|---|---|
| vector A | `vector` | SVG, 1344 by 756 | `dcb53f4f-ba3d-4a58-a4c5-ae721ebc76d7` | `hf_20261114_202710_dcb53f4f-ba3d-4a58-a4c5-ae721ebc76d7.svg` |
| vector B | `vector` | SVG, 1344 by 756 | `d3c2f600-c33b-45c3-9bb6-9c55c5f87d6e` | `hf_20261114_202709_d3c2f600-c33b-45c3-9bb6-9c55c5f87d6e.svg` |
| standard A | `standard` | PNG, 2688 by 1536 | `be54b30e-12c2-4a17-b970-2a8a2ee8459b` | `hf_20261114_202712_be54b30e-12c2-4a17-b970-2a8a2ee8459b.png` |
| standard B | `standard` | PNG, 2688 by 1536 | `aa742c0a-2d5c-4156-97e6-7e4531acef76` | `hf_20261114_202712_aa742c0a-2d5c-4156-97e6-7e4531acef76.png` |

The files are in `takes/`, under the names in the first column (`vector-a.svg`, `vector-b.svg`, `standard-a.png`, `standard-b.png`), as downloaded.

What the session that ran the test saw, for the maintainer to weigh; the choice of look is theirs:

- **Vector A** is the closest to the brand. It is a real SVG of 164 flat shapes, and almost every fill is a palette colour exactly. The tree sits right of centre with empty sky on the left, as asked. The slide's shape is confused, and the dark shadow under the deck is heavy.
- **Vector B** has the most hand-made character: 504 shapes with printed-looking texture. Its blue and violet are off the palette, and bushes come into the lower left where captions would sit.
- **Standard A** drew the foliage brown and the treehouse small. The weakest of the four.
- **Standard B** is the most charming picture, with soft grain and a clear ladder, deck, and slide. Its sun sits where the words go, its oranges are off the palette, and it is a picture, so using it means tracing.
- **`style/3-fit.svg`** is stiffer than any take, but it is the only one that carries the blueprint outline and the captions, and the only one whose every part is drawn by code.

Both SVG takes are a flat stack of paths with no groups, so no take comes with parts that can be animated separately. The film needs the same treehouse in about ten states (a box in a tree, a pine tree, a slide through the ladder, a sketch, a village), which a generator will not draw consistently. So a generated take serves better as the target for the look than as the artwork itself: the scenes in `art.cjs` are redrawn toward it.

A cloud session needs `d8j0ntlcm91z4.cloudfront.net` (where Higgsfield stores results) and `fonts.googleapis.com` and `fonts.gstatic.com` (Space Grotesk) allowed in its environment. The maintainer opened the Default environment to all domains on 2026-11-14 after the first attempt was refused.

## Scene takes

Generated on 2026-11-14 on the maintainer's word, with the recipe above and a prompt for each scene; all are `vector` SVG files in `takes/`. The first six cost 60 credits and the two village retakes 20. With the illustration test, 116 credits have been spent on the film.

| File | Scene | Used | Job ID |
|---|---|---|---|
| `scene-literal-a.svg` | A box in a tree | No: outlined, with a violet ground | `89a6afd7-abc4-4fb1-9848-c16eb9d7d2ee` |
| `scene-literal-b.svg` | A box in a tree (retry) | Yes | `68d1d09f-d9f6-4068-b97d-f5bb9979c3b2` |
| `scene-literal-c.svg` | A box in a tree (retry) | No: violet bushes | `231e6baf-a0ea-42a7-96cb-13973fd94d5b` |
| `scene-pine-a.svg` | A pine tree, the house moved, a ladder | No longer: a different tree from the next beat's | `56f6a5bb-4c44-41e6-a750-fe83a7dfb7f2` |
| `scene-bolted-a.svg` | The slide through the ladder | Yes, with and without its slide | `cf04d631-1cfa-4af3-b7ae-3f5015a55077` |
| `scene-village-a.svg` | A village of treehouses | No longer: ladders short of the ground, flags off the roofs | `b7e17ad6-fcaa-4871-b14f-862ad7de1275` |
| `scene-village-b.svg` | A village (retake) | No: little sky for the words | `6b4dc357-04d3-46b2-93ec-897e80c72065` |
| `scene-village-c.svg` | A village (retake) | Yes | `c4c904b4-ea01-43cb-bcd8-109af4a73599` |

The prompts are in the Higgsfield account under those jobs. Each began "Flat vector editorial illustration for a motion-graphics explainer film" and described the scene, then B's foliage, trunk, sky, sun, bushes, and flowers. The first prompts added "hand-drawn with printed dry-brush texture", and one of those four came back outlined; the retries dropped that phrase, added "no black line work", and both came back in style.

## Reference editing test

On 2026-11-14 the maintainer asked whether models exist that keep elements consistent, so that the session need not redraw them, and said to try it, with cost estimates, and to plan for the most professional version.

Recraft V4.1, used for every take above, accepts no reference picture, so each take was a new roll. Higgsfield also offers models that edit from references, and video models that take a first and a last frame. Costs were quoted first (2026-11-14, 16:9):

| Model | Use | Quoted cost |
|---|---|---|
| `gpt_image_2_6`, 2k, quality high, one reference | Edit a picture, keep the rest | 2.75 credits |
| `gpt_image_2_6`, 2k, quality medium | The same, cheaper | 1 credit |
| `flux_3_image`, 2k, one reference | Edit a picture | 3 credits |
| `minimax_h3`, 5 seconds, 2K, first and last frame | Animate between two of our frames | 10 credits |
| `kling3_0_turbo`, 5 seconds, 1080p, first frame only | Animate from one frame | 10 credits |
| `flux_3_video`, 5 seconds, 1080p, first and last frame, no audio | Animate between two frames | 40 credits |

The test: three edits with `gpt_image_2_6` from one reference, the film's treehouse with its slide (`takes/ref-*.png`, 2688 by 1520, about 8 credits), and one `minimax_h3` clip from the before and after frames (10 credits).

| File | Asked for | Result | Job ID |
|---|---|---|---|
| `ref-literal-a.png` | The same hill and tree with only a box in the branches | The hill, bushes, flowers, sun and style are the reference's; the tree is redrawn close to it | `e5ca1801-3a9c-47c2-99b1-a60f18f73170` |
| `ref-pine-a.png` | The same hill with a pine, the house moved, a ladder | The same world and the same cabin, tilted on a pine | `78d5576a-c09c-4e7d-8f90-0c3050254b3c` |
| `ref-village-a.png` | A village of the same treehouse | Five treehouses of the film's design with bridges, ladders to the grass, and open sky; all five have slides, where one was asked for | `9bc5c38d-3bb4-4e67-af9d-32dcafb56a72` |

The clip, `takes/ref-slide-minimax.mp4` (job `c4a8828f-9169-4179-896f-f5c6d50b6210`, 5 seconds, 2560 by 1440, 24 frames a second): the slide unrolls from the deck to the grass, the flag moves, and the rest of the picture holds still and flat.

What it shows: an edit from a reference keeps the world, where separate takes did not, and a video model can animate one change between two of our frames without redrawing the rest. The results are pictures, not vector, so parts are removed with a further edit and not with `kit.cjs`. The test cost 18.25 credits; 134 have been spent on the film, and the account held 791 afterwards.

## The village, designed

The maintainer on the first reference village (2026-11-14): "much better but it looks like it's describing a copy-paste project. What we want are 4 more very different treehouse designs all in the same architectural family as the first." Four designs were made one at a time from the film's treehouse (`gpt_image_2_6`, quality high, 2.75 credits each), then composed with it into one picture from all five references (two takes).

| File | What it is | Job ID |
|---|---|---|
| `design-lookout-a.png` | The Lookout: a tall orange tower with a crow's nest and telescope | `358a5872-5654-4a9e-b9b4-4b5016e8829c` |
| `design-longhouse-a.png` | The Long House: a wide violet cabin across two limbs, with a porch and a swing | `121cd038-c4a9-44c6-9314-91c34b093f17` |
| `design-roundhouse-a.png` | The Roundhouse: a round blue cabin with a cone roof and a spiral stair | `d874f0cf-47f3-43b2-98be-93f43086584e` |
| `design-workshop-a.png` | The Workshop: an orange A-frame with a hoist and bucket | `f4d5a769-df57-4f2e-8f3b-6ccf6ba36dc1` |
| `ref-village-b.png` | The five together, first take | `69a1a920-e3e0-4cdd-a792-9f3cdcabc40e` |
| `ref-village-c.png` | The five together, second take; in the film from the sixth cut | `39c12b84-59e1-4bb5-916b-fc7838046916` |

This step cost 16.5 credits; 150.5 have been spent on the film, and the account held 774.5 afterwards.

## Doing it right

The maintainer on 2026-11-14: "don't compromise in advance. find out what it'll take to do it right. go all out in the design." And of the test clip: "I like the slide animation." This replaces the session's earlier, trimmed plan. Each stage ends with the maintainer's approval before the next.

1. **Script.** Settle the words before more pictures: the end card's line, the order of the collaborator beats, and whether any beat goes. Free.
2. **Design.** Every picture the film needs, edited from the master so all share one world, explored at quality high and approved as a sheet: the empty hill, the box in the tree, the pine with the house moved and a ladder, the slide through the ladder (from the pine), night, the sketch, the treehouse with a bare pole, with its flag, with its slide, the village. The trouble half is redone this way, so it stands on the film's own hill.
3. **Finals.** Each approved picture is made again at the best quality the model offers.
4. **Motion.** One clip for each change, between two approved pictures, several takes each, and the best take chosen: the box arriving, the tree becoming a pine, the slide going through the ladder, night to morning, the sketch becoming the treehouse, the flag going up, the slide unrolling, the pull back from one treehouse to the village. One shot is made on both video models first, to learn whether the costlier one is better on this artwork.
5. **Words and assembly.** Headings, bubbles, the outline, the turn, and the end card stay in code over the clips, because a model does not set exact words reliably. `film.cjs` gains clips as layers.
6. **Sound.** Music and effects cut to picture, with the licence for web, social, and paid use checked first.
7. **Review.** An independent creative review of the assembled cut, then the maintainer's.
8. **Cuts.** The 16:9 master, a vertical and a square cut, and a 15-second cut, with the words laid out again for each shape.

Quoted on 2026-11-14 (16:9, one reference unless said):

| What | Cost |
|---|---|
| Still, `gpt_image_2_6`, 2k, quality high | 2.75 credits |
| Still, 2k, quality xhigh | 4.5 credits |
| Still, 4k, quality max | 15 credits |
| Clip, 5 seconds, `minimax_h3`, 2K, first and last frame | 10 credits |
| Clip, 5 seconds, `flux_3_video`, 1080p, first and last frame | 40 credits |
| Clip, 5 seconds, `flux_3_video`, 4k | 65 credits |

| Stage | Assumption | Estimate |
|---|---|---|
| Design | 12 pictures, 3 takes each at quality high | about 100 credits |
| Finals | 12 pictures, 2 takes each at 4k, quality max | about 360 credits (about 110 at 2k, quality xhigh) |
| Motion | 8 clips, 4 takes each on `minimax_h3` | about 320 credits |
| Model comparison | One shot, 2 takes on `flux_3_video` at 4k | about 130 credits |
| Costlier model for every shot, if it wins | 8 clips, 3 takes each at 4k | about 1,560 credits in place of the 320 |
| Sound | Not yet quoted | unknown; allow 100 |
| Retakes after review | A quarter of design, finals, and motion | about 200 credits |
| **Total** | | **about 1,200 credits on `minimax_h3` with 4k stills; about 2,500 if every shot is made on the costlier model** |

The account holds 774.5 credits, so doing all of it needs more than is there. What 4k stills buy for a film delivered at 1080p is headroom for the pull back and for a later 4K master; the session has not yet seen whether quality max looks better than quality high on this artwork.

## Tools worth adding

## Tools worth adding

From research on 2026-11-14; claims about vendors' terms were not all checked first-hand.

| Tool | What it would add | Note |
|---|---|---|
| GSAP | Professional easing, timelines, staggers, type and shape morphing, on the SVG scenes as they are | Free for commercial use. The same code could run live on the homepage. |
| HyperFrames or Remotion | A maintained render harness with audio sync and transitions, in place of the hand-written loop | HyperFrames is Apache 2.0. Remotion is free up to three employees and has motion blur. |
| ElevenLabs direct, or Epidemic Sound | Sound effects, and music with a licence that is clear for web, social, and paid use | Check which licence covers music generated through Higgsfield. |
| Frame.io | Notes pinned to a frame, which an agent can read back as a list of changes | Confirm API access on the plan first. |
| dotLottie | Small, crisp vector loops for the homepage | Suits short loops, not the whole film. |
