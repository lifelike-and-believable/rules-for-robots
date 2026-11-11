# Research note: tools and approaches (2026-10)

Verdicts: ADOPT (use it), TRIAL (try it on one gallery), SKIP.

| Tool or approach | Verdict | Notes |
|---|---|---|
| Editor agent bridge (MCP server inside the Unreal editor) | ADOPT | Lets agents and the chat assistant open levels, place actors, and change properties. It has no authentication; anyone who can reach its port can drive the editor. |
| Open capture streaming format | ADOPT | Records and streams capture data between machines. Replays well. |
| Lip-sync plugin from a third-party vendor | ADOPT | Best quality we tested. Released for Unreal Engine 5.8 only. |
| Cloud speech recognition, language model, and voice | ADOPT | Fast and good quality. Needs an internet connection. |
| Local speech and voice models on the show machine | TRIAL | Works offline. Slower; quality is acceptable for short answers. |
| Building our own lighting console in the web dashboard | SKIP | Venues already have consoles and operators who know them. |
| Git with LFS for the Unreal project | ADOPT | The studio already uses it. File locking is not set up. |
| Ready-made show-control software | TRIAL | Several venues already use it. |
