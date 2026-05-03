---
"http-proxy-agent": minor
"https-proxy-agent": minor
"socks-proxy-agent": minor
---

Add `proxy` event emission on the request object for all proxy agents. After the proxy connection is established, the request emits a `proxy` event with `{ proxy, socket }` where `proxy` is the proxy URL string. This is useful for debugging and logging which proxy was used for a connection.
