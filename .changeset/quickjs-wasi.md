---
"degenerator": minor
"pac-resolver": minor
"pac-proxy-agent": minor
---

Replace `@tootallnate/quickjs-emscripten` with `quickjs-wasi` for running sandboxed PAC file code. `quickjs-wasi` is a lighter-weight QuickJS WASM runtime built on quickjs-ng with WASI reactor mode. The `compile()` function now takes a `QuickJS` instance directly instead of `QuickJSWASMModule`, and `createPacResolver()` / `pac-proxy-agent` are updated accordingly.
