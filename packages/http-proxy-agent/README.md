http-proxy-agent
================
### An HTTP(s) proxy `http.Agent` implementation for HTTP

> **Security Notice:** `http-proxy-agent@5` depends on the vulnerable
> `@tootallnate/once@2` package ([CVE-2026-3449](https://github.com/advisories/GHSA-vpq2-c234-7xj6)).
> This dependency was removed in v7+. If you are using v5, please upgrade to v7
> or later. See [#406](https://github.com/TooTallNate/proxy-agents/issues/406).

This module provides an `http.Agent` implementation that connects to a specified
HTTP or HTTPS proxy server, and can be used with the built-in `http` module.

__Note:__ For HTTP proxy usage with the `https` module, check out
[`https-proxy-agent`](../https-proxy-agent).


Example
-------

```ts
import * as http from 'http';
import { HttpProxyAgent } from 'http-proxy-agent';

const agent = new HttpProxyAgent('http://168.63.76.32:3128');

http.get('http://nodejs.org/api/', { agent }, (res) => {
  console.log('"response" event!', res.headers);
  res.pipe(process.stdout);
});
```

API
---

### new HttpProxyAgent(proxy: string | URL, options?: HttpProxyAgentOptions)

The `HttpProxyAgent` class implements an `http.Agent` subclass that connects
to the specified "HTTP(s) proxy server" in order to proxy HTTP requests.

The `proxy` argument is the URL for the proxy server.

The `options` argument accepts the usual `http.Agent` constructor options, and
some additional properties:

 * `headers` - Object containing additional headers to send to the proxy server
   in each request. This may also be a function that returns a headers object.
  
   **NOTE:** If your proxy does not strip these headers from the request, they
   will also be sent to the destination server.