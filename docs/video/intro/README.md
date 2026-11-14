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

Not yet decided: whether the four style frames are the look; length (the proxy runs 66 seconds, and about 45 is the aim); sound.

## Files

| File | What it is |
|---|---|
| `animatic.html` | The proxy: the whole film at sketch quality, playable in a browser, with the beats as a list. The timing and every word are in its `BEATS` array. |
| `frames.js` | Renders the animatic. `node frames.js sheet` writes one frame for each beat; `node frames.js render 20` writes every frame at 20 a second, for ffmpeg to encode. |
| `art.js` | Draws the four style frames as SVG: the trouble, the turn, the fit, the promise. `node art.js` writes them to `style/`. |
| `stylepng.js` | Renders the style frames to PNG at 1920 by 1080. |
| `style/` | The four style frames. |
| `takes/` | The four generated takes from the illustration test, as downloaded. |

The scripts need Playwright with its Chromium, and ffmpeg, which this repository does not install. The animatic and the frames use Space Grotesk from Google Fonts.

## Next

1. **The illustration test.** Run on 2026-11-14 for 36 of the approved 100 Higgsfield credits; the takes are listed under "Illustration test takes" below and wait for the maintainer to compare them with `style/3-fit.svg`. The tracing step has not been tried, and is only needed if a `standard` take is chosen. Recipe: model Recraft V4.1; aspect 16:9; resolution 2k; two variants with `model_type` `vector` and two with `standard`; colours `#FFF4E6 #2A1A14 #E4572E #B8401D #2563C4 #7A45C9 #0E8A72 #0B6E5B #F9C9B2`; prompt:

   > Flat vector editorial illustration for a motion-graphics explainer film. A charming children's treehouse in a large round leafy tree on a gentle grassy hill: wooden deck with a railing, a small blue cabin with a violet pitched roof, a round glowing window, a small door, an orange pennant flag on the roof, a wooden ladder on the left, and a bright orange slide curving down on the right. Warm cream sky, a large orange sun, layered mint-green hills behind, small flowers in the grass. Bold simple shapes with hand-made character, subtle grain texture, soft shadows, no outlines, no people, no text, no lettering. The tree sits right of centre with empty sky on the left.

   Get the cost first, keep every take, and compare the results with `style/3-fit.svg`. If the generated look is better, try tracing one to vector layers with the Adobe vectorize tool.
2. **The look.** The maintainer approves the style frames, code-drawn or generated, before anything is animated.
3. **Production.** Animate each beat to the approved look, cut toward 45 seconds, and render at 1080p.

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

Both SVG takes are a flat stack of paths with no groups, so no take comes with parts that can be animated separately. The film needs the same treehouse in about ten states (a box in a tree, a pine tree, a slide through the ladder, a sketch, a village), which a generator will not draw consistently. So a generated take serves better as the target for the look than as the artwork itself: the scenes in `art.js` would be redrawn toward it.

A cloud session needs `d8j0ntlcm91z4.cloudfront.net` (where Higgsfield stores results) and `fonts.googleapis.com` and `fonts.gstatic.com` (Space Grotesk) allowed in its environment. The maintainer opened the Default environment to all domains on 2026-11-14 after the first attempt was refused.

## Tools worth adding

From research on 2026-11-14; claims about vendors' terms were not all checked first-hand.

| Tool | What it would add | Note |
|---|---|---|
| GSAP | Professional easing, timelines, staggers, type and shape morphing, on the SVG scenes as they are | Free for commercial use. The same code could run live on the homepage. |
| HyperFrames or Remotion | A maintained render harness with audio sync and transitions, in place of the hand-written loop | HyperFrames is Apache 2.0. Remotion is free up to three employees and has motion blur. |
| ElevenLabs direct, or Epidemic Sound | Sound effects, and music with a licence that is clear for web, social, and paid use | Check which licence covers music generated through Higgsfield. |
| Frame.io | Notes pinned to a frame, which an agent can read back as a list of changes | Confirm API access on the plan first. |
| dotLottie | Small, crisp vector loops for the homepage | Suits short loops, not the whole film. |
