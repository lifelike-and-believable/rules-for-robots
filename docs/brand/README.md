# Brand

Rules for Robots is one guide in several volumes. Every mark is the same bound guide with the same robot R as its opening capital. A volume differs in its cover colour and in what sits beside the R.

## The volumes

| Volume | Repository | Cover | Beside the R | Says |
|---|---|---|---|---|
| Rules for Robots | the organization | Orange `#E4572E` | Lines of text | The guide as a whole |
| Core | `rules-for-robots-core` | Orange `#E4572E` | Lines of text | The rules every agent starts from |
| Engineering | `rules-for-robots-engineering` | Blue `#2563C4` | A command-line prompt over stepped lines of code | Building software with agents |
| Creation | `rules-for-robots-creation` | Violet `#7A45C9` | A picture: a sun over hills | Making pictures, video, and games with agents |
| Research | `rules-for-robots-research` | Green `#0E8A72` | A magnifying glass over lines of text | Finding things out with agents |

Core has no mark of its own. It is the part every volume builds on, so it carries the orange mark, and the word "Core" under the name tells it apart.

## What is fixed and what varies

| Fixed in every mark | Varies by volume |
|---|---|
| The spine down the left edge | The cover colour, with its darker spine and its pale tint |
| The robot R: antenna, eye, cream ink | The motif beside and below the R |
| The name "Rules for Robots" in Space Grotesk Bold | The second word, in Space Grotesk Medium |

## Colours

Each volume has three colours, and all volumes share two.

| Token | Rules for Robots and Core | Engineering | Creation | Research | Use |
|---|---|---|---|---|---|
| `cover` | `#E4572E` | `#2563C4` | `#7A45C9` | `#0E8A72` | The cover, and the ground of a social preview |
| `spine` | `#B8401D` | `#1E4F9D` | `#6237A1` | `#0B6E5B` | The spine. Also the volume's word on a light page |
| `tint` | `#F9C9B2` | `#BEC9DC` | `#D7C0DD` | `#B7D4C3` | The motif. Also the volume's word on a dark page |

| Shared token | Value | Use |
|---|---|---|
| `cream` | `#FFF4E6` | The R, and the name on a cover or a dark page |
| `ink` | `#2A1A14` | The eye, and the name on a light page |

The values are in `tokens.json`, which the generator reads.

## Type

- Space Grotesk Bold for the name, Space Grotesk Medium for a volume's word and for the line under the name on a social preview.
- Inter for running text beside the brand, such as documentation pages.
- The names in these files are outlines, stored in `wordmarks.json`, so no file here needs a font installed.

## Files

| Folder | Holds | Use |
|---|---|---|
| `marks/` | The square mark for each volume, as SVG and as a 512 pixel PNG | Avatars and plugin icons. It is full bleed, so the host's own crop rounds it |
| `lockups/` | The mark with the name beside it, in a `-light` and a `-dark` version | README headers and documentation. Light is for light pages, dark for dark pages |
| `social/` | A 1280 by 640 image for each volume, as SVG and PNG | A repository's Settings, General, Social preview |

To show a lockup at the top of a README so that it follows the reader's theme:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/lockups/engineering-dark.svg">
  <img src="docs/brand/lockups/engineering-light.svg" alt="Rules for Robots Engineering" height="64">
</picture>
```

## Using the marks

- Keep clear space around a mark of at least the width of its spine.
- Do not recolour a mark, swap motifs between volumes, or remove the R's antenna or eye.
- Do not set the name in another typeface or weight.
- Below 32 pixels the motifs stop reading and only the colour tells the volumes apart. Where a mark must work at 16 or 20 pixels, use the orange mark for the brand as a whole.
- GitHub shows an organization's avatar beside each of its repositories, so the volume marks appear in README headers, social previews, plugin icons, and documentation.

## Adding a volume

1. Choose a cover colour that differs clearly in hue from the four in use. Its spine is the cover darkened by a fifth; its tint is the cover mixed seven parts in ten toward cream.
2. Draw a motif for the space beside the R (x 79 to 108, y 29 to 71 on the 128 grid) and below it (x 32 to 108, y 78 to 105), in the tint, with strokes 6.5 to 8 units wide and round ends.
3. Add the volume to `tokens.json` and the motif to `build.mjs`.
4. Add the volume's word and the line for its social preview to `wordmarks.json`. They are outlines of Space Grotesk Medium at 100 pixels with the baseline at y = 0.
5. Run the two commands below, and check the mark at 32 and 64 pixels beside the others.

## Changing anything

Edit `tokens.json` or `build.mjs`, never the generated files, then run:

```
node docs/brand/build.mjs
node docs/brand/render.mjs
```

The first writes every SVG and needs nothing installed. The second renders the PNG files and needs Playwright with its Chromium; any other tool that renders an SVG at the same size will do.

## How it was chosen

The maintainer chose each part from drawn options on 2026-11-14.

- The mark, over four rounds: the R with an antenna and an eye from five ideas, that R as the opening capital of a text, the spine that makes the text a bound guide, and the orange from six palettes.
- The family, over four rounds: a motif and a colour for each volume, over colour alone or a ribbon on an orange cover; the prompt for Engineering, with stepped lines so the mark sits level; the magnifying glass for Research, because a chart read as statistics only.
- Core keeps the orange mark, on the session's recommendation.
- The line under each name on the social previews was written by the session and has not been reviewed.
