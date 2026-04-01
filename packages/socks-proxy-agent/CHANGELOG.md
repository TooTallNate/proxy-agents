# socks-proxy-agent

## 10.0.0

### Major Changes

- 7d12b51: Set minimum Node.js version to 20

### Patch Changes

- 7ca27d0: Simplify package.json exports to remove unnecessary imports restriction
- Updated dependencies [ca12148]
- Updated dependencies [7d12b51]
- Updated dependencies [7ca27d0]
  - agent-base@9.0.0

## 9.0.0

### Major Changes

- 9c92c09: Convert to ESM. All packages now use `"type": "module"` and compile to ESM output instead of CommonJS.

### Patch Changes

- Updated dependencies [9c92c09]
  - agent-base@8.0.0

## 8.0.5

### Patch Changes

- 913a49a: Only overwrite servername in tls connect when host is not an IP address
- Updated dependencies [1699a09]
  - agent-base@7.1.2

## 8.0.4

### Patch Changes

- fdeed27: resolve vulnerability in IP package
- 5908e84: Remove `net.isIP()` check for TLS `servername`

## 8.0.3

### Patch Changes

- ada656d: Pass `socket_options` to `SocksClient`
- Updated dependencies [e62863c]
  - agent-base@7.1.1

## 8.0.2

### Patch Changes

- 1d39f6c: Fix Electron support by using Node.js native URL object

## 8.0.1

### Patch Changes

- 7674748: Update `@types/node` to v14.18.45
- Updated dependencies [7674748]
  - agent-base@7.0.1

## 8.0.0

### Major Changes

- d99a7c8: Major version bump for all packages
  - ⚠️ This is a breaking change! The `SocksProxyAgent` constructor argument has been split into two arguments.

#### Upgrading from 5.x to 6.x

In version 5.x, the `SocksProxyAgent` constructor took a single argument of either (A) a `string`, or (B) an object with specific connection
properties.

Now the constructor takes two _separate_ arguments:

- Argument 1: Either (A) a `string`, or (B) a [WHATWG `URL` object](https://nodejs.org/docs/latest-v14.x/api/url.html#url_the_whatwg_url_api)
- Argument 2 (optional): An object with standard [`http.Agent`](https://nodejs.org/docs/latest-v14.x/api/url.html#url_the_whatwg_url_api)
  properties.

If you were using an object argument in 7.x, you'll need to change the first argument to match the structure of the `URL` class, and move
any other options to the second argument.

7.x usage:

```ts
const agent = new SocksProxyAgent({
	hostname: 'myproxy.mydomain.com',
	userId: 'proxyUser',
	password: 'proxyPass'
  timeout: 1000
});
```

Updated 8.x usage:

```ts
const agent = new SocksProxyAgent(
  {
    hostname: 'myproxy.mydomain.com'
    username: 'proxyUser',
    password: 'proxyPass'
  },
  {
    timeout: 1000
  }
);
```

### Minor Changes

- 4333067: Add support for core `keepAlive: true`

### Patch Changes

- c169ced: Convert mocha tests to jest for all packages
- Updated dependencies [c169ced]
- Updated dependencies [d99a7c8]
- Updated dependencies [4333067]
  - agent-base@7.0.0
