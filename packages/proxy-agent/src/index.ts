import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import LRUCache from 'lru-cache';
import { Agent, AgentConnectOpts } from 'agent-base';
import createDebug from 'debug';
import { getProxyForUrl as envGetProxyForUrl } from 'proxy-from-env';
import type { PacProxyAgent, PacProxyAgentOptions } from 'pac-proxy-agent';
import type { HttpProxyAgent, HttpProxyAgentOptions } from 'http-proxy-agent';
import type {
	HttpsProxyAgent,
	HttpsProxyAgentOptions,
} from 'https-proxy-agent';
import type {
	SocksProxyAgent,
	SocksProxyAgentOptions,
} from 'socks-proxy-agent';

const debug = createDebug('proxy-agent');

type ValidProtocol =
	| (typeof HttpProxyAgent.protocols)[number]
	| (typeof HttpsProxyAgent.protocols)[number]
	| (typeof SocksProxyAgent.protocols)[number]
	| (typeof PacProxyAgent.protocols)[number];

type AgentConstructor = new (
	proxy: string,
	proxyAgentOptions?: ProxyAgentOptions
) => Agent;

type GetProxyForUrlCallback = (
	url: string,
	req: http.ClientRequest
) => string | Promise<string>;

/**
 * Shorthands for built-in supported types.
 * Lazily loaded since some of these imports can be quite expensive
 * (in particular, pac-proxy-agent).
 */
const wellKnownAgents = {
	http: async () => (await import('http-proxy-agent')).HttpProxyAgent,
	https: async () => (await import('https-proxy-agent')).HttpsProxyAgent,
	socks: async () => (await import('socks-proxy-agent')).SocksProxyAgent,
	pac: async () => (await import('pac-proxy-agent')).PacProxyAgent,
} as const;

/**
 * Supported proxy types.
 */
export const proxies: {
	[P in ValidProtocol]: [
		() => Promise<AgentConstructor>,
		() => Promise<AgentConstructor>
	];
} = {
	http: [wellKnownAgents.http, wellKnownAgents.https],
	https: [wellKnownAgents.http, wellKnownAgents.https],
	socks: [wellKnownAgents.socks, wellKnownAgents.socks],
	socks4: [wellKnownAgents.socks, wellKnownAgents.socks],
	socks4a: [wellKnownAgents.socks, wellKnownAgents.socks],
	socks5: [wellKnownAgents.socks, wellKnownAgents.socks],
	socks5h: [wellKnownAgents.socks, wellKnownAgents.socks],
	'pac+data': [wellKnownAgents.pac, wellKnownAgents.pac],
	'pac+file': [wellKnownAgents.pac, wellKnownAgents.pac],
	'pac+ftp': [wellKnownAgents.pac, wellKnownAgents.pac],
	'pac+http': [wellKnownAgents.pac, wellKnownAgents.pac],
	'pac+https': [wellKnownAgents.pac, wellKnownAgents.pac],
};

function isValidProtocol(v: string): v is ValidProtocol {
	return Object.keys(proxies).includes(v);
}

export type ProxyAgentOptions = HttpProxyAgentOptions<''> &
	HttpsProxyAgentOptions<''> &
	SocksProxyAgentOptions &
	PacProxyAgentOptions<''> & {
		/**
		 * Default `http.Agent` instance to use when no proxy is
		 * configured for a request. Defaults to a new `http.Agent()`
		 * instance with the proxy agent options passed in.
		 */
		httpAgent?: http.Agent;
		/**
		 * Default `http.Agent` instance to use when no proxy is
		 * configured for a request. Defaults to a new `https.Agent()`
		 * instance with the proxy agent options passed in.
		 */
		httpsAgent?: http.Agent;
		/**
		 * A callback for dynamic provision of proxy for url.
		 * Defaults to standard proxy environment variables,
		 * see https://www.npmjs.com/package/proxy-from-env for details
		 */
		getProxyForUrl?: GetProxyForUrlCallback;
	};

/**
 * Uses the appropriate `Agent` subclass based off of the "proxy"
 * environment variables that are currently set.
 *
 * An LRU cache is used, to prevent unnecessary creation of proxy
 * `http.Agent` instances.
 */
export class ProxyAgent extends Agent {
	/**
	 * Cache for `Agent` instances.
	 */
	cache = new LRUCache<string, Agent>({
		max: 20,
		dispose: (agent) => agent.destroy(),
	});

	connectOpts?: ProxyAgentOptions;
	httpAgent: http.Agent;
	httpsAgent: http.Agent;
	getProxyForUrl: GetProxyForUrlCallback;

	constructor(opts?: ProxyAgentOptions) {
		super(opts);
		debug('Creating new ProxyAgent instance: %o', opts);
		this.connectOpts = opts;
		this.httpAgent = opts?.httpAgent || new http.Agent(opts);
		this.httpsAgent =
			opts?.httpsAgent || new https.Agent(opts as https.AgentOptions);
		this.getProxyForUrl = opts?.getProxyForUrl || envGetProxyForUrl;
	}

	async connect(
		req: http.ClientRequest,
		opts: AgentConnectOpts
	): Promise<http.Agent> {
		const { secureEndpoint } = opts;
		const isWebSocket = req.getHeader('upgrade') === 'websocket';
		const protocol = secureEndpoint
			? isWebSocket
				? 'wss:'
				: 'https:'
			: isWebSocket
			? 'ws:'
			: 'http:';
		const host = req.getHeader('host');
		const url = new URL(req.path, `${protocol}//${host}`).href;
		const proxy = await this.getProxyForUrl(url, req);

		if (!proxy) {
			debug('Proxy not enabled for URL: %o', url);
			return secureEndpoint ? this.httpsAgent : this.httpAgent;
		}

		debug('Request URL: %o', url);
		debug('Proxy URL: %o', proxy);

		// attempt to get a cached `http.Agent` instance first
		const cacheKey = `${protocol}+${proxy}`;
		let agent = this.cache.get(cacheKey);
		if (!agent) {
			const proxyUrl = new URL(proxy);
			const proxyProto = proxyUrl.protocol.replace(':', '');
			if (!isValidProtocol(proxyProto)) {
				throw new Error(`Unsupported protocol for proxy URL: ${proxy}`);
			}
			const ctor = await proxies[proxyProto][
				secureEndpoint || isWebSocket ? 1 : 0
			]();
			agent = new ctor(proxy, this.connectOpts);
			this.cache.set(cacheKey, agent);
		} else {
			debug('Cache hit for proxy URL: %o', proxy);
		}

		return agent;
	}

	destroy(): void {
		for (const agent of this.cache.values()) {
			agent.destroy();
		}
		super.destroy();
	}
}
