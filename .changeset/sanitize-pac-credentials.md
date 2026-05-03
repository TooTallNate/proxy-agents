---
'pac-proxy-agent': patch
---

Add `sanitizeProxyResultCredentials()` utility to strip embedded credentials from PAC proxy results in debug/error log output, preventing accidental credential leakage.
