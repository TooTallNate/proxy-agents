---
'pac-proxy-agent': patch
'degenerator': patch
'pac-resolver': patch
---

Update `quickjs-wasi` to v3.0.0. WASM bytes are now explicitly loaded via `readFile()` instead of relying on implicit filesystem I/O.
