---
"http-proxy-agent": minor
---

feat(http-proxy-agent): emit 'proxyConnect' event

Adds `proxyConnect` event emission to `http-proxy-agent` for parity with `https-proxy-agent`. The event is emitted on both the request and the agent instance when the socket connects to the proxy server.
