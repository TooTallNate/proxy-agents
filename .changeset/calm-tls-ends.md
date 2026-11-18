---
'https-proxy-agent': patch
---

Fix an unhandled "error" event that crashed the process when an HTTPS proxy closed the connection during the TLS handshake.
