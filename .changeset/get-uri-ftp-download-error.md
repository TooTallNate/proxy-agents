---
'get-uri': patch
---

Fix unhandled promise rejection in the `ftp:` protocol handler when the data transfer fails after `getUri()` has resolved. The error is now emitted on the returned stream instead of crashing the process.
