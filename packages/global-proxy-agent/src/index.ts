import http from 'http';
import https from 'https';
import semver from 'semver';
import createDebug from 'debug';

type AgentType = http.Agent | https.Agent;

const debug = createDebug('global-proxy-agent');

export function bindHttpMethod(
	originalMethod: (...args: unknown[]) => unknown,
	agent: AgentType,
	forceGlobalAgent: boolean
) {
	return (...args: unknown[]) => {
		let url;
		let options: Record<string, unknown>;
		let callback;

		if (typeof args[0] === 'string' || args[0] instanceof URL) {
			url = args[0];

			if (typeof args[1] === 'function') {
				options = {};
				callback = args[1];
			} else {
				options = {
					...(args[1] as object),
				};
				callback = args[2];
			}
		} else {
			options = {
				...(args[0] as object),
			};
			callback = args[1];
		}

		if (forceGlobalAgent) {
			options.agent = agent;
		} else {
			if (!options.agent) {
				options.agent = agent;
			}

			if (
				options.agent === http.globalAgent ||
				options.agent === https.globalAgent
			) {
				options.agent = agent;
			}
		}

		if (url) {
			return originalMethod(url, options, callback);
		} else {
			return originalMethod(options, callback);
		}
	};
}

/**
 * @property forceGlobalAgent Forces to use `global-proxy-agent` HTTP(S) agent even when request was explicitly constructed with another agent. (Default: `true`)
 * @property http Defines that http module should use proxy. (Default: `true`)
 * @property https Defines that https module should use proxy. (Default: `true`)
 */
export interface GlobalProxyAgentOptions {
	forceGlobalAgent?: boolean;
	http?: boolean;
	https?: boolean;
}

const httpGet = http.get;
const httpRequest = http.request;
const httpsGet = https.get;
const httpsRequest = https.request;
const httpGlobalAgent = http.globalAgent;
const httpsGlobalAgent = https.globalAgent;

/**
 * enableGlobalProxyAgent replaces http.globalAgent/https.globalAgent with provided proxyAgent
 * @param proxyAgent
 * @param options
 * @see https://github.com/gajus/global-agent
 * @return disableGlobalProxyAgent - Disables globalProxyAgent
 */
export function enableGlobalProxyAgent(
	proxyAgent: AgentType,
	options?: GlobalProxyAgentOptions
): () => void {
	const forceGlobalAgent = options?.forceGlobalAgent ?? true;
	const skipHttp = options?.http === false;
	const skipHttps = options?.https === false;

	// Overriding globalAgent was added in v11.7.
	// @see https://nodejs.org/uk/blog/release/v11.7.0/
	if (semver.gte(process.version, 'v11.7.0')) {
		if (!skipHttp) {
			debug('replace http.globalAgent');
			// @see https://github.com/facebook/flow/issues/7670
			http.globalAgent = proxyAgent;
		}

		if (!skipHttps) {
			debug('replace https.globalAgent');
			// @ts-expect-error Node.js version compatibility
			https.globalAgent = proxyAgent;
		}
	}

	// The reason this logic is used in addition to overriding http(s).globalAgent
	// is because there is no guarantee that we set http(s).globalAgent variable
	// before an instance of http(s).Agent has been already constructed by someone,
	// e.g. Stripe SDK creates instances of http(s).Agent at the top-level.
	// @see https://github.com/gajus/global-agent/pull/13
	//
	// We still want to override http(s).globalAgent when possible to enable logic
	// in `bindHttpMethod`.
	if (semver.gte(process.version, 'v10.0.0')) {
		if (!skipHttp) {
			debug('bindHttpMethod', 'http.get', forceGlobalAgent);
			// @ts-expect-error seems like we are using wrong type for httpAgent
			http.get = bindHttpMethod(httpGet, proxyAgent, forceGlobalAgent);

			debug('bindHttpMethod', 'http.request', forceGlobalAgent);
			// @ts-expect-error seems like we are using wrong type for httpAgent
			http.request = bindHttpMethod(
				// @ts-expect-error seems like we are using wrong type for httpAgent
				httpRequest,
				proxyAgent,
				forceGlobalAgent
			);
		}

		if (!skipHttps) {
			debug('bindHttpMethod', 'https.get', forceGlobalAgent);
			// @ts-expect-error seems like we are using wrong type for httpsAgent
			https.get = bindHttpMethod(httpsGet, proxyAgent, forceGlobalAgent);

			debug('bindHttpMethod', 'https.request', forceGlobalAgent);
			// @ts-expect-error seems like we are using wrong type for httpsAgent
			https.request = bindHttpMethod(
				// @ts-expect-error seems like we are using wrong type for httpsAgent
				httpsRequest,
				proxyAgent,
				forceGlobalAgent
			);
		}
	} else {
		// eslint-disable-next-line no-console
		console.warn(
			'attempt to initialize global proxy-agent in unsupported Node.js version was ignored'
		);
	}

	return () => {
		if (semver.gte(process.version, 'v11.7.0')) {
			if (!skipHttp) {
				debug('restore http.globalAgent');
				http.globalAgent = httpGlobalAgent;
			}
			if (!skipHttps) {
				debug('restore https.globalAgent');
				https.globalAgent = httpsGlobalAgent;
			}
		}
		if (semver.gte(process.version, 'v10.0.0')) {
			if (!skipHttp) {
				debug('restore http.get', forceGlobalAgent);
				http.get = httpGet;

				debug('restore http.request', forceGlobalAgent);
				http.request = httpRequest;
			}
			if (!skipHttps) {
				debug('restore https.get', forceGlobalAgent);
				https.get = httpsGet;

				debug('restore https.request', forceGlobalAgent);
				https.request = httpsRequest;
			}
		}
	};
}
