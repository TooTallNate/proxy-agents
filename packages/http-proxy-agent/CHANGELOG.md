# http-proxy-agent

## 9.1.0

### Minor Changes

- d8f2926: Adds `proxyConnect` event emission to `http-proxy-agent` for parity with `https-proxy-agent`. The event is emitted on both the request and the agent instance when the socket connects to the proxy server.
- 84e85ed: Add `onProxyAuth` callback and `negotiate` option for Kerberos/SPNEGO proxy authentication

  - Extract shared Negotiate/SPNEGO auth logic into new `proxy-agent-negotiate` package
  - Added optional `onProxyAuth` async callback to `HttpsProxyAgent` and `HttpProxyAgent` options
  - When the proxy responds with 407 Proxy-Authentication Required, the callback is invoked with the response and auth scheme
  - The callback returns headers (e.g. `Proxy-Authorization`) to retry the request with
  - Added `negotiate: true` option that uses the `kerberos` package for automatic Negotiate/SPNEGO auth
  - Added `kerberos` as an optional peer dependency of `proxy-agent-negotiate`
  - Extended the `proxy` test package to support `authenticate: 'negotiate'` mode for mock testing

- 3ebf4b2: Add `proxy` event emission on the request object for all proxy agents. After the proxy connection is established, the request emits a `proxy` event with `{ proxy, socket }` where `proxy` is the proxy URL string. This is useful for debugging and logging which proxy was used for a connection.

### Patch Changes

- Updated dependencies [84e85ed]
  - proxy-agent-negotiate@1.1.0

## 9.0.0

### Major Changes

- 7d12b51: Set minimum Node.js version to 20

### Patch Changes

- 7ca27d0: Simplify package.json exports to remove unnecessary imports restriction
- Updated dependencies [ca12148]
- Updated dependencies [7d12b51]
- Updated dependencies [7ca27d0]
  - agent-base@9.0.0

## 8.0.0

### Major Changes

- 9c92c09: Convert to ESM. All packages now use `"type": "module"` and compile to ESM output instead of CommonJS.

### Patch Changes

- Updated dependencies [9c92c09]
  - agent-base@8.0.0

## 7.0.2

### Patch Changes

- b88ab46: Import `url` instead of `node:url` 🤷‍♂️

## 7.0.1

### Patch Changes

- c3c405e: Add missing `URL` type import

## 7.0.0

### Major Changes

- b3860aa: Remove `secureProxy` getter

  It was not meant to be a public property. If you were using it, just use `agent.proxy.protocol === 'https:'` instead.

## 6.1.1

### Patch Changes

- eb6906b: Fix `keepAlive: true`
- Updated dependencies [da699b1]
  - agent-base@7.1.0

## 6.1.0

### Minor Changes

- 1069932: Added "headers" option

### Patch Changes

- Updated dependencies [66b4c63]
  - agent-base@7.0.2

## 6.0.1

### Patch Changes

- 7674748: Update `@types/node` to v14.18.45
- Updated dependencies [7674748]
  - agent-base@7.0.1

## 6.0.0

### Major Changes

- d99a7c8: Major version bump for all packages
  - ⚠️ This is a breaking change! The `HttpProxyAgent` constructor argument has been split into two arguments.

#### Upgrading from 5.x to 6.x

In version 5.x, the `HttpProxyAgent` constructor took a single argument of either (A) a `string`, or (B) an object matching the output of
the [deprecated `url.parse()` method](https://nodejs.org/docs/latest-v14.x/api/url.html#url_url_parse_urlstring_parsequerystring_slashesdenotehost)
_and_ various extra options.

Now the constructor takes two _separate_ arguments:

- Argument 1: Either (A) a `string`, or (B) a [WHATWG `URL` object](https://nodejs.org/docs/latest-v14.x/api/url.html#url_the_whatwg_url_api)
- Argument 2 (optional): An object with standard [`http.Agent`](https://nodejs.org/docs/latest-v14.x/api/url.html#url_the_whatwg_url_api),
  `net.TcpNetConnectOpts`, and `tls.ConnectionOptions` properties.

If you were using an object argument in 5.x, you'll need to change the first argument to match the structure of the `URL` class, and move
any other options to the second argument.

5.x usage:

```ts
const agent = new HttpProxyAgent({
  protocol: 'https:',
  host: 'myproxy.mydomain.com'
  port: '1234',
  auth: 'proxyUser:proxyPass',
  timeout: 1000
});
```

Updated 6.x usage:

```ts
const agent = new HttpProxyAgent(
  {
    protocol: 'https:',
    hostname: 'myproxy.mydomain.com'
    port: '1234',
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
