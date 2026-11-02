---
id: design-<feature>
status: draft
derived-from:
  - story-<epic>-<name>:
  - persona-<name>#frustrations:
---

# <Feature> design

<!-- docs/design/<feature>.md. The user documentation is written from this. -->

## Personas

- <persona-name>: <which of their goals and frustrations this design answers, and how>

## Flow

1. <Step the user takes, and what they see.>

## Mock-ups

<!-- Required for every screen, panel, menu, or dialog this design adds or changes. Wireframes are
enough; they do not need to be polished. Put images in docs/design/<feature>/ with their editable source
beside them (an HTML file rendered to PNG, say), or link to the design tool (Figma, Penpot,
Excalidraw), and say which state each one shows. For a third-party interface, the mock-ups settle
wording and states; say which of the tool's behaviours the design assumes. The approver and the persona
walkthrough judge the design from these, so a control named in the text appears in a mock-up.
When several phone-sized frames share one HTML page, give each frame container-type: inline-size and use
cqw where the site uses vw, or the units measure the page instead of the phone. For a "text at 200%"
frame, double the root font size, not a wrapper's. -->

| Screen or state | Mock-up | Notes |
|---|---|---|
| <Default> | ![<Default>](<feature>/default.png) | <...> |
| <Error> | <link to the frame> | <...> |

## Layout

<What the mock-ups do not show: responsive behaviour, placement in the existing UI, and the name of
each control exactly as the user documentation will use it.>

## States and errors

- <Empty, loading, partial, error, and success states, and what each says.>

## How it works

<!-- Answer each that applies; the persona walkthrough checks these. -->

- **How does the system know?** For each status, count, or message the design shows: where the fact comes from, and whether it survives a reload, another device, or another person's session.
- **What enforces each promise, and what checks it?** For each "never", "always", or privacy promise ("visitors never see drafts"): the mechanism that makes it true, and the test or check that would notice if it stopped being true.
- **What is published together?** For content edited in a CMS: which fields go live in one publish, and whether a mistake in one can block or expose another.

## Accessibility

- <Keyboard, screen reader, colour, and motion notes.>
