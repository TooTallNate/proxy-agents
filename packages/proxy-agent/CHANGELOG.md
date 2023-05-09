# proxy-agent

## 6.2.0

### Minor Changes

- 0bbe335: Support for `getProxyForUrl` option, to provide proxy address dynamically per different URLs

### Patch Changes

- Updated dependencies [bf20b04]
  - pac-proxy-agent@6.0.2

## 6.1.2

### Patch Changes

- 7674748: Update `@types/node` to v14.18.45
- Updated dependencies [fd6209c]
- Updated dependencies [c573dbe]
- Updated dependencies [7674748]
  - https-proxy-agent@6.1.0
  - socks-proxy-agent@8.0.1
  - http-proxy-agent@6.0.1
  - pac-proxy-agent@6.0.1
  - agent-base@7.0.1

## 6.1.1

### Patch Changes

- f30ed32: Use `HttpProxyAgent` for "http" and `HttpsProxyAgent` for "https"

## 6.1.0

### Minor Changes

- 9a90063: Add support for `httpAgent` and `httpsAgent` options

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
  - pac-proxy-agent@6.0.0
  - agent-base@7.0.0
