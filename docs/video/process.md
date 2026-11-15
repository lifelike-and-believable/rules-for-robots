# A process for a short film

How a session and a person make a short promotional film together. It was written on 2026-11-14 from the first trial, the intro video in [`intro/`](intro/README.md), after the maintainer asked to "back up and do the professional process" in place of rendering the film again after each change. It is a draft and may become the basis for a skill in a video volume of Rules for Robots.

The idea is the one behind the software process: each approval locks one thing before the next, costlier stage starts. The person approves decisions (the words, the look, the pictures, the cut). The session does everything between without asking. Checks are technical only; taste is the person's.

## Stages

| # | Stage | What it produces | The person approves | What it costs |
|---|---|---|---|---|
| 1 | Brief | Who it is for, what it must say, where it plays, the shapes and lengths to deliver | The brief | Nothing |
| 2 | Script | Every beat in order: the picture in words, every word on screen, the seconds | The script | Nothing |
| 3 | Look | One master picture, and the palette and type that go with it | The master | A few takes |
| 4 | Design | Every picture the script names, each edited from the master, on one sheet | The sheet | A few credits a picture |
| 5 | Animatic | The approved pictures and words, timed, with no generated motion; reviewed independently | The timing | Nothing; rendered in code |
| 6 | Motion | One clip for each change, between two approved pictures; several takes, the best chosen | The clips | The most of any stage |
| 7 | Assembly | The words set in code over the clips; one cut | | Nothing |
| 8 | Sound | Music and effects cut to the picture | The mix | Quoted first |
| 9 | Review | An independent review of the cut, its findings fixed or put to the person | The film | Retakes |
| 10 | Cuts | The other shapes and lengths, with the words laid out again for each | Each cut | Little |

## Rules

- **Nothing is made for a stage until the stage before it is approved.** A change to an approved stage goes back to that stage and is approved again there. The film is rendered at the animatic, at assembly, and after review, and not after each change.
- **Changes are gathered and made together.** The person's notes on a stage are answered in one revision of that stage.
- **Every picture comes from the master.** A picture is made by editing the master, or a picture already edited from it, with a model that takes references. Pictures made separately do not share a world, and the session's own drawing does not match a generated look.
- **Motion is generated between approved pictures.** The first and last frame of a clip are both approved pictures, so a clip cannot change what was agreed.
- **A motion prompt asks for the change and nothing more.** A model shows every word of a prompt, so a flourish written in ("bounces once as it lands") lands in the clip. Where one does, cut it out of the take before paying for a retake.
- **Words stay in code.** Headings, speech, and the end card are set by the program over the pictures, because a model does not set exact words reliably, and words change late.
- **The cost is quoted before a run**, the person names a limit for the stage, and every take is kept and listed with its job.
- **Review is independent.** A fresh agent is given the work, the brief, and the script, and no opinion of it. It reviews the animatic, when a change is cheap, and the assembled film.
- **The record is the stage's document**, in the film's folder: the brief, the script, the sheet of pictures with their jobs, the decisions and who made them.

## Checks

Technical conformance that the session can verify itself. Each belongs to the stage that can fix it most cheaply.

| Check | Stage | What it catches in the trial |
|---|---|---|
| Reading time: the words on screen in a beat, divided by its seconds, stay under about four a second, and the last line holds at least a second and a half | Script, animatic | A beat of 35 words in 4.6 seconds |
| The script says what the thing is and how to get it | Script | A film that never named what it advertised |
| No line contradicts the name or the promise | Script | Mocking "So you write rules" in a film for Rules for Robots |
| Continuity: a thing appears only after the beat that causes it | Script, design | A flag already orange when its colour was asked for |
| One world: the pictures share the ground, the light, and the style | Design | A different pine tree in two beats that should differ by one slide |
| Things connect: ladders reach the ground, flags stand on roofs, a slide ends on grass | Design | A village whose ladders stopped in the air |
| Variety where the script promises it | Design | A village that looked copied and pasted |
| Room for words: a clear column or band where the script puts text | Design, animatic | Headings running into trees |
| Nothing left over: guides and sketches are gone once the thing is built | Animatic | Dashes over finished artwork |
| The first frame is a picture | Animatic | A blank poster frame |

## What the trial taught

- The script was never locked, so problems with what the film says were found by a review of the second cut, after the pictures and the motion were made.
- The first model took no reference, so every scene was a new roll, and the session patched pictures by hand; the person called one patch childish. A model that edits from a reference kept the world for under three credits a picture.
- The session re-rendered the film after each note. Six cuts were made where three would have done.
- The session held back fixes that touched the story or cost credits and asked about each; the person wanted them applied within a named limit.
- An independent review found in minutes what the session and the person had both stopped seeing.
