# Requirements: production workflow

- **WFL-1.** Artists build galleries, characters, and effects in the Unreal editor on studio workstations.
- **WFL-2.** Generation tools (image, texture, voice, and 3D model generators) produce draft assets, which an artist reviews before use.
- **WFL-3.** Both artists and the generation agents work on the same gallery levels in parallel.
- **WFL-4.** The shared back end holds the project state: assets, cue lists, character settings, and approvals. Each venue's show machine loads the current cue list and character settings from it when the show starts each morning.
- **WFL-5.** The producer and director see progress and approve work in a web dashboard.
- **WFL-6.** All live data (capture, cues, and AI guide conversations) passes through the shared back end, so every performance can be logged and replayed.
- **WFL-7.** A chat assistant answers the team's questions about the project and can make changes through the same back end.
- **WFL-8.** To save the producer time, the assistant approves a collaborator's asset licence automatically when its terms match the standard template.
- **WFL-9.** During a performance, the operator can ask the chat assistant to fire a cue or change a character's mood.
- **WFL-10.** Contractors and the partner museum's curator can ask the assistant to change a scene in the editor, from their own computers.
- **WFL-11.** Each content generator runs as its own service, so the generators can scale and fail separately.
- **WFL-12.** The producer gets a weekly report of the questions visitors asked the AI guides, to improve the answers.

## Constraints

- The team is six people plus contractors. Nobody is dedicated to operations.
