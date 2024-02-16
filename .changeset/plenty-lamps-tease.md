---
'socks-proxy-agent': minor
---

You can now use SOCKS proxy chains by passing an array of SOCKS proxy URLs to the `SocksProxyAgent()` constructor:

```ts
const agent = new SocksProxyAgent([
  'socks://user:pass@host:port',
  'socks://user:pass@host:port',
  'socks://user:pass@host:port',
]);
```
