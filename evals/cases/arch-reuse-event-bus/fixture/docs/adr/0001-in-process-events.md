# 1. In-process events between modules

Status: accepted

Modules talk through `src/events.js` instead of calling each other. Handlers run in the same process, which is enough while the service runs as a single instance.
