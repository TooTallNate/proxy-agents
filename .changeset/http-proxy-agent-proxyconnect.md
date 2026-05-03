---
"http-proxy-agent": minor
---

Adds `proxyConnect` event emission to `http-proxy-agent` for parity with `https-proxy-agent`. The event is emitted on both the request and the agent instance when the socket connects to the proxy server.
