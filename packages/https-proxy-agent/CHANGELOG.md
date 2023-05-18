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
  - ⚠️ This is a breaking change! The `HttpsProxyAgent` constructor argument has been split into two arguments.

#### Upgrading from 5.x to 6.x

In version 5.x, the `HttpsProxyAgent` constructor took a single argument of either (A) a `string`, or (B) an object matching the output of
the [deprecated `url.parse()` method](https://nodejs.org/docs/latest-v14.x/api/url.html#url_url_parse_urlstring_parsequerystring_slashesdenotehost)
_and_ various extra options.
    
Now the constructor takes two _separate_ arguments:

* Argument 1: Either (A) a `string`, or (B) a [WHATWG `URL` object](https://nodejs.org/docs/latest-v14.x/api/url.html#url_the_whatwg_url_api)
* Argument 2 (optional): An object with standard [`http.Agent`](https://nodejs.org/docs/latest-v14.x/api/url.html#url_the_whatwg_url_api),
  `net.TcpNetConnectOpts`, and `tls.ConnectionOptions` properties and/or custom options supported by this package.

If you were using an object argument in 5.x, you'll need to change the first argument to match the structure of the `URL` class, and move
any other options to the second argument.

5.x usage:

```ts
const agent = new HttpsProxyAgent({
  protocol: 'https:',
  host: 'myproxy.mydomain.com'
  port: '1234',
  auth: 'proxyUser:proxyPass',
  timeout: 1000,
  headers: { 'trace', 'foo' }
});
```

Updated 6.x usage:

```ts
const agent = new HttpsProxyAgent(
  {
    protocol: 'https:',
    hostname: 'myproxy.mydomain.com'
    port: '1234',
    username: 'proxyUser',
    password: 'proxyPass'
  },
  {
    timeout: 1000,
    headers: { 'trace', 'foo' }
  }
);
```

### Minor Changes

- 4333067: Add support for core `keepAlive: true`

### Patch Changes

- c169ced: Convert mocha tests to jest for all packages
- 06775a8: Add test for `rejectUnauthorized: false` missing on request options
- Updated dependencies [c169ced]
- Updated dependencies [d99a7c8]
- Updated dependencies [4333067]
  - agent-base@7.0.0
