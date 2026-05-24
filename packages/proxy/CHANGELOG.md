# proxy

## 4.1.0

### Minor Changes

- 84e85ed: Add `onProxyAuth` callback and `negotiate` option for Kerberos/SPNEGO proxy authentication

  - Extract shared Negotiate/SPNEGO auth logic into new `proxy-agent-negotiate` package
  - Added optional `onProxyAuth` async callback to `HttpsProxyAgent` and `HttpProxyAgent` options
  - When the proxy responds with 407 Proxy-Authentication Required, the callback is invoked with the response and auth scheme
  - The callback returns headers (e.g. `Proxy-Authorization`) to retry the request with
  - Added `negotiate: true` option that uses the `kerberos` package for automatic Negotiate/SPNEGO auth
  - Added `kerberos` as an optional peer dependency of `proxy-agent-negotiate`
  - Extended the `proxy` test package to support `authenticate: 'negotiate'` mode for mock testing

### Patch Changes

- 31d7ef1: Reject URLs longer than 4096 characters with HTTP 414 to prevent potential DoS via excessively long inputs
- 0f40077: Replace `basic-auth-parser` dependency with built-in implementation

## 4.0.0

### Major Changes

- 7d12b51: Set minimum Node.js version to 20

### Patch Changes

- 7ca27d0: Simplify package.json exports to remove unnecessary imports restriction

## 3.0.0

### Major Changes

- 9c92c09: Convert to ESM. All packages now use `"type": "module"` and compile to ESM output instead of CommonJS.

## 2.2.0

### Minor Changes

- 28104d2: Add bin for CLI

## 2.1.1

### Patch Changes

- 25e0c93: Ensure that `socket.remoteAddress` is a string

## 2.1.0

### Minor Changes

- 0f31047: Add `localAddress` option to specify which networking interface the proxy should use to create outgoing connections

## 2.0.1

### Patch Changes

- 7674748: Update `@types/node` to v14.18.45

## 2.0.0

### Major Changes

- d99a7c8: Major version bump for all packages

### Patch Changes

- c169ced: Convert mocha tests to jest for all packages
