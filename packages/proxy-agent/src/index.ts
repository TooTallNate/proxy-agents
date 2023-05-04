import * as http from 'http';
import * as https from 'https';
import LRUCache from 'lru-cache';
import { Agent, AgentConnectOpts } from 'agent-base';
import createDebug from 'debug';
import { getProxyForUrl } from 'proxy-from-env';
import { PacProxyAgent, PacProxyAgentOptions } from 'pac-proxy-agent';
import { HttpProxyAgent, HttpProxyAgentOptions } from 'http-proxy-agent';
import { HttpsProxyAgent, HttpsProxyAgentOptions } from 'https-proxy-agent';
import { SocksProxyAgent, SocksProxyAgentOptions } from 'socks-proxy-agent';

const debug = createDebug('proxy-agent');

const PROTOCOLS = [
	...HttpProxyAgent.protocols,
	...SocksProxyAgent.protocols,
	...PacProxyAgent.protocols,
] as const;

type ValidProtocol = (typeof PROTOCOLS)[number];

/**
 * Supported proxy types.
 */
export const proxies: {
	[P in ValidProtocol]: new (...args: never[]) => Agent;
} = {
	http: HttpProxyAgent,
	https: HttpsProxyAgent,
	socks: SocksProxyAgent,
	socks4: SocksProxyAgent,
	socks4a: SocksProxyAgent,
	socks5: SocksProxyAgent,
	socks5h: SocksProxyAgent,
	'pac-data': PacProxyAgent,
	'pac-file': PacProxyAgent,
	'pac-ftp': PacProxyAgent,
	'pac-http': PacProxyAgent,
	'pac-https': PacProxyAgent,
};

function isValidProtocol(v: string): v is ValidProtocol {
	return (PROTOCOLS as readonly string[]).includes(v);
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
	cache = new LRUCache<string, Agent>({ max: 20 });

	connectOpts?: ProxyAgentOptions;
	httpAgent: http.Agent;
	httpsAgent: http.Agent;

	constructor(opts?: ProxyAgentOptions) {
		super(opts);
		debug('Creating new ProxyAgent instance: %o', opts);
		this.connectOpts = opts;
		this.httpAgent = opts?.httpAgent || new http.Agent(opts);
		this.httpsAgent =
			opts?.httpsAgent || new https.Agent(opts as https.AgentOptions);
	}

	async connect(
		req: http.ClientRequest,
		opts: AgentConnectOpts
	): Promise<http.Agent> {
		const protocol = opts.secureEndpoint ? 'https:' : 'http:';
		const host = req.getHeader('host');
		const url = new URL(req.path, `${protocol}//${host}`).href;
		const proxy = getProxyForUrl(url);

		if (!proxy) {
			debug('Proxy not enabled for URL: %o', url);
			return opts.secureEndpoint ? this.httpsAgent : this.httpAgent;
		}

		debug('Request URL: %o', url);
		debug('Proxy URL: %o', proxy);

		// attempt to get a cached `http.Agent` instance first
		let agent = this.cache.get(proxy);
		if (!agent) {
			const proxyUrl = new URL(proxy);
			const proxyProto = proxyUrl.protocol.replace(':', '');
			if (!isValidProtocol(proxyProto)) {
				throw new Error(`Unsupported protocol for proxy URL: ${proxy}`);
			}
			const ctor = proxies[proxyProto];
			// @ts-expect-error meh…
			agent = new ctor(proxy, this.connectOpts);
			this.cache.set(proxy, agent);
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
