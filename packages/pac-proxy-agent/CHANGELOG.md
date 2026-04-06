# pac-proxy-agent

## 9.0.1

### Patch Changes

- 16a7c8a: Update QuickJS integration for `quickjs-wasi` v2.2.0. This removes deprecated `unwrapResult()` / `dispose(false)` usage and avoids duplicate sandbox host callback registration when recompiling PAC resolvers.
- Updated dependencies [16a7c8a]
  - pac-resolver@9.0.1

## 9.0.0

### Major Changes

- 7d12b51: Set minimum Node.js version to 20

### Patch Changes

- 7ca27d0: Simplify package.json exports to remove unnecessary imports restriction
- Updated dependencies [4e922b5]
- Updated dependencies [ca12148]
- Updated dependencies [7d12b51]
- Updated dependencies [7ca27d0]
  - get-uri@8.0.0
  - agent-base@9.0.0
  - http-proxy-agent@9.0.0
  - https-proxy-agent@9.0.0
  - pac-resolver@9.0.0
  - socks-proxy-agent@10.0.0

## 8.0.0

### Major Changes

- 9c92c09: Convert to ESM. All packages now use `"type": "module"` and compile to ESM output instead of CommonJS.

### Minor Changes

- b1509d8: Replace `@tootallnate/quickjs-emscripten` with `quickjs-wasi` for running sandboxed PAC file code. `quickjs-wasi` is a lighter-weight QuickJS WASM runtime built on quickjs-ng with WASI reactor mode. The `compile()` function now takes a `QuickJS` instance directly instead of `QuickJSWASMModule`, and `createPacResolver()` / `pac-proxy-agent` are updated accordingly.

### Patch Changes

- Updated dependencies [9c92c09]
- Updated dependencies [b1509d8]
  - agent-base@8.0.0
  - http-proxy-agent@8.0.0
  - https-proxy-agent@8.0.0
  - socks-proxy-agent@9.0.0
  - pac-resolver@8.0.0
  - get-uri@7.0.0

## 7.2.0

### Minor Changes

- 9d462b8: Expose `PacProxyAgent.getResolver()` publicly

## 7.1.0

### Minor Changes

- 38760db: Lazily load agents inside pac-proxy-agent

### Patch Changes

- 77c3599: use WHATWG URL class to construct url parameter
- 913a49a: Only overwrite servername in tls connect when host is not an IP address
- e90e2b2: Properly forward WebSocket requests via PAC agents that resolve to HTTP proxies
- Updated dependencies [913a49a]
- Updated dependencies [1699a09]
  - https-proxy-agent@7.0.6
  - socks-proxy-agent@8.0.5
  - agent-base@7.1.2

## 7.0.2

### Patch Changes

- fdeed27: resolve vulnerability in IP package
- 5908e84: Remove `net.isIP()` check for TLS `servername`
- Updated dependencies [fdeed27]
- Updated dependencies [5908e84]
  - socks-proxy-agent@8.0.4
  - https-proxy-agent@7.0.5

## 7.0.1

### Patch Changes

- 1d39f6c: Fix Electron support by using Node.js native URL object
- Updated dependencies [1d39f6c]
- Updated dependencies [e625d10]
  - socks-proxy-agent@8.0.2
  - https-proxy-agent@7.0.2

## 7.0.0

### Major Changes

- f1f3220: Use `quickjs-emscripten` instead of `vm2` to execute PAC file code

### Patch Changes

- Updated dependencies [f1f3220]
  - pac-resolver@7.0.0

## 6.0.4

### Patch Changes

- 999dd9d: Fix `pac+` prefixed protocol URIs

## 6.0.3

### Patch Changes

- Updated dependencies [b3860aa]
  - https-proxy-agent@7.0.0
  - http-proxy-agent@7.0.0

## 6.0.2

### Patch Changes

- bf20b04: Add `servername` to tls connection options when pac-proxy-agent results in DIRECT connection

## 6.0.1

### Patch Changes

- 7674748: Update `@types/node` to v14.18.45
- Updated dependencies [fd6209c]
- Updated dependencies [c573dbe]
- Updated dependencies [7674748]
  - https-proxy-agent@6.1.0
  - socks-proxy-agent@8.0.1
  - http-proxy-agent@6.0.1
  - pac-resolver@6.0.1
  - agent-base@7.0.1
  - get-uri@6.0.1

## 6.0.0

### Major Changes

- d99a7c8: Major version bump for all packages

### Minor Changes

- 4333067: Add support for core `keepAlive: true`

### Patch Changes

- c169ced: Convert mocha tests to jest for all packages
- Updated dependencies [c169ced]
- Updated dependencies [d99a7c8]
- Updated dependencies [4333067]
- Updated dependencies [06775a8]
  - https-proxy-agent@6.0.0
  - socks-proxy-agent@8.0.0
  - http-proxy-agent@6.0.0
  - pac-resolver@6.0.0
  - agent-base@7.0.0
  - get-uri@6.0.0
