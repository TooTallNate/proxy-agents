---
'https-proxy-agent': major
'http-proxy-agent': major
---

Remove `secureProxy` getter

It was not meant to be a public property. If you were using it, just use `agent.proxy.protocol === 'https:'` instead.
