---
'https-proxy-agent': patch
---

Wait for the whole body of a non-200 CONNECT response (up to its `Content-Length`, capped at 64 KiB) before replaying it to the HTTP client. Previously only the bytes that arrived with the headers were replayed, so a body sent in a later TCP segment was cut off and the client saw the response abort instead of a complete error response.
