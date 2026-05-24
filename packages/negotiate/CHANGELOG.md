# proxy-agent-negotiate

## 1.1.0

### Minor Changes

- 84e85ed: Add `onProxyAuth` callback and `negotiate` option for Kerberos/SPNEGO proxy authentication

  - Extract shared Negotiate/SPNEGO auth logic into new `proxy-agent-negotiate` package
  - Added optional `onProxyAuth` async callback to `HttpsProxyAgent` and `HttpProxyAgent` options
  - When the proxy responds with 407 Proxy-Authentication Required, the callback is invoked with the response and auth scheme
  - The callback returns headers (e.g. `Proxy-Authorization`) to retry the request with
  - Added `negotiate: true` option that uses the `kerberos` package for automatic Negotiate/SPNEGO auth
  - Added `kerberos` as an optional peer dependency of `proxy-agent-negotiate`
  - Extended the `proxy` test package to support `authenticate: 'negotiate'` mode for mock testing
