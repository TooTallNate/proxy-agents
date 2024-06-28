# pac-proxy-agent

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
