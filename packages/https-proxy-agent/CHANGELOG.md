# https-proxy-agent

## 6.1.0

### Minor Changes

- fd6209c: Emit "proxyConnect" event on HTTP `request` object (part of #153)
- c573dbe: Emit "proxyConnect" event on Agent instance

### Patch Changes

- 7674748: Update `@types/node` to v14.18.45
- Updated dependencies [7674748]
  - agent-base@7.0.1

## 6.0.0

### Major Changes

- d99a7c8: Major version bump for all packages

### Minor Changes

- 4333067: Add support for core `keepAlive: true`

### Patch Changes

- c169ced: Convert mocha tests to jest for all packages
- 06775a8: Add test for `rejectUnauthorized: false` missing on request options
- Updated dependencies [c169ced]
- Updated dependencies [d99a7c8]
- Updated dependencies [4333067]
  - agent-base@7.0.0
