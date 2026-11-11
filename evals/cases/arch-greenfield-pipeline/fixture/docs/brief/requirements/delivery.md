# Requirements: delivery and venues

- **DLV-1.** A show must never stop in front of visitors. If something fails, the gallery falls back to a calm idle state and recovers without visitors noticing.
- **DLV-2.** Galleries cannot count on internet access. Every in-gallery function works with no internet connection.
- **DLV-3.** Each gallery has one show machine driving its projectors, plus a spare.
- **DLV-4.** Twelve standalone headsets in gallery 3 show the same scene as the projection, from the visitor's position.
- **DLV-5.** At the "surfacing" moment, the projection, the headsets, and the livestream show the same event at the same instant, with lighting and sound cues on the beat.
- **DLV-6.** The livestream of scheduled performances goes to a video platform for schools, with a delay of up to 30 seconds.
- **DLV-7.** Venue staff install new show builds from a versioned package and can roll back to the previous build.
- **DLV-8.** The exhibit is packed, shipped, and set up at a new venue within five working days.

## Constraints

- Venue machines are on the venue's network, which the studio does not control.
- Venue IT allows outbound connections only on ports 80 and 443.
