import net from 'net';
import tls from 'tls';
import { Url } from 'url';
import { AgentOptions } from 'agent-base';
import { OutgoingHttpHeaders } from 'http';
import _HttpsProxyAgent from './agent';

function createHttpsProxyAgent(
	opts: string | createHttpsProxyAgent.HttpsProxyAgentOptions
): _HttpsProxyAgent {
	return new _HttpsProxyAgent(opts);
}

namespace createHttpsProxyAgent {
	interface BaseHttpsProxyAgentOptions {
		headers?: OutgoingHttpHeaders;
		secureProxy?: boolean;
		host?: string | null;
		path?: string | null;
		port?: string | number | null;
	}

	export interface HttpsProxyAgentOptions
		extends AgentOptions,
			BaseHttpsProxyAgentOptions,
			Partial<
				Omit<
					Url & net.NetConnectOpts & tls.ConnectionOptions,
					keyof BaseHttpsProxyAgentOptions
				>
			> {}

	export type HttpsProxyAgent = _HttpsProxyAgent;
	export const HttpsProxyAgent = _HttpsProxyAgent;

	createHttpsProxyAgent.prototype = _HttpsProxyAgent.prototype;
}

export = createHttpsProxyAgent;
