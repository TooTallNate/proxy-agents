---
'degenerator': patch
'pac-proxy-agent': patch
'pac-resolver': patch
---

Update QuickJS integration for `quickjs-wasi` v2.2.0. This removes deprecated `unwrapResult()` / `dispose(false)` usage and avoids duplicate sandbox host callback registration when recompiling PAC resolvers.
