---
'get-uri': patch
'http-proxy-agent': patch
'https-proxy-agent': patch
'pac-proxy-agent': patch
'proxy-agent': patch
'proxy': patch
'socks-proxy-agent': patch
---

Replace the `debug` dependency with [`obug`](https://github.com/sxzz/obug), a zero-dependency ESM/TypeScript fork of `debug`. The `DEBUG` environment variable and namespaces are unchanged; the `@types/debug` dev dependency is no longer needed since `obug` ships its own types.
