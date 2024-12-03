global-proxy-agent
===========
### Registers provided agent as global `HTTP`/`HTTPS` proxy

This module provides an `enableGlobalProxyAgent` method to replace `http.globalAgent`/`https.globalAgent` with provided proxy agent.

Example
-------

```ts
import * as https from 'https';
import { ProxyAgent } from 'proxy-agent';
import { enableGlobalProxyAgent } from 'global-proxy-agent';

// You may use any proxy agent implementation (see https://github.com/TooTallNate/proxy-agents)
const agent = new ProxyAgent();

enableGlobalProxyAgent(agent)

// The rest works just like any other normal HTTP request
https.get('https://jsonip.com', (res) => {
  console.log(res.statusCode, res.headers);
  res.pipe(process.stdout);
});
```

API
---

### enableGlobalProxyAgent(proxyAgent: http.Agent | https.Agent, options?: GlobalProxyAgentOptions)

```ts
interface GlobalProxyAgentOptions {
	forceGlobalAgent?: boolean;
	http?: boolean; // true - skips http module
	https?: boolean; // true - skips https module
}
```

Replaces global proxy agent and returns callback to disable global proxy.

Example

```ts
import * as https from 'https';
import { ProxyAgent } from 'proxy-agent';
import { enableGlobalProxyAgent } from 'global-proxy-agent';

const agent = new ProxyAgent();

const disableGlobalProxyAgent = enableGlobalProxyAgent(agent, { https: false })

https.get('https://jsonip.com', (res) => {
  console.log(res.statusCode, res.headers);
  res.pipe(process.stdout);
});

setTimeout(() => disableGlobalProxyAgent(), 5000)
```
