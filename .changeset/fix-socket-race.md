---
'https-proxy-agent': patch
---

Fix socket event race condition by deferring `socket.resume()` via `setImmediate()`, ensuring HTTP client machinery has time to attach data listeners before data starts flowing
