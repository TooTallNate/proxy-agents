import { protocols as gProtocols } from 'get-uri';
import { format } from 'url';
import { AgentOptions } from 'agent-base';
import { PacResolverOptions } from 'pac-resolver';
import { HttpProxyAgentOptions } from 'http-proxy-agent';
import { HttpsProxyAgentOptions } from 'https-proxy-agent';
import { SocksProxyAgentOptions } from 'socks-proxy-agent';
import _PacProxyAgent from './agent';

function createPacProxyAgent(
	uri: string,
	opts?: createPacProxyAgent.PacProxyAgentOptions
): _PacProxyAgent;
function createPacProxyAgent(
	opts: createPacProxyAgent.PacProxyAgentOptions
): _PacProxyAgent;
function createPacProxyAgent(
	uri?: string | createPacProxyAgent.PacProxyAgentOptions,
	opts?: createPacProxyAgent.PacProxyAgentOptions
): _PacProxyAgent {
	// was an options object passed in first?
	if (typeof uri === 'object') {
		opts = uri;

		// result of a url.parse() call?
		if (opts.href) {
			if (opts.path && !opts.pathname) {
				opts.pathname = opts.path;
			}
			opts.slashes = true;
			uri = format(opts);
		} else {
			uri = opts.uri;
		}
	}
	if (!opts) {
		opts = {};
	}

	if (typeof uri !== 'string') {
		throw new TypeError('a PAC file URI must be specified!');
	}

	return new _PacProxyAgent(uri, opts);
}

namespace createPacProxyAgent {
	export interface PacProxyAgentOptions
		extends AgentOptions,
			PacResolverOptions,
			HttpProxyAgentOptions,
			HttpsProxyAgentOptions,
			SocksProxyAgentOptions {
		uri?: string;
		fallbackToDirect?: boolean;
	}

	export type PacProxyAgent = _PacProxyAgent;
	export const PacProxyAgent = _PacProxyAgent;

	/**
	 * Supported "protocols". Delegates out to the `get-uri` module.
	 */
	export const protocols = Object.keys(gProtocols);

	createPacProxyAgent.prototype = _PacProxyAgent.prototype;
}

export = createPacProxyAgent;
