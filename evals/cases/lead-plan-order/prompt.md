Plan this feature for our team of agents. Do not build anything.

Feature: users can tag their notes.

Required:
1. Store tags per note.
2. `POST /notes/:id/tags` adds a tag and `DELETE /notes/:id/tags/:tag` removes one.
3. `GET /notes?tag=x` returns only notes with that tag.
4. The notes page shows each note's tags.

Not required, only if there is time: CSV export of tagged notes, and a colour for each tag.
