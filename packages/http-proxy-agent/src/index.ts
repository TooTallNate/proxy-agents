import * as net from 'net';
import * as tls from 'tls';
import * as http from 'http';
import createDebug from 'debug';
import once from '@tootallnate/once';
import { Agent, AgentConnectOpts } from 'agent-base';

const debug = createDebug('http-proxy-agent');

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type Protocol<T> = T extends `${infer Protocol}:${infer _}` ? Protocol : never;

type ConnectOptsMap = {
	http: Omit<net.TcpNetConnectOpts, 'host' | 'port'>;
	https: Omit<tls.ConnectionOptions, 'host' | 'port'>;
};

type ConnectOpts<T> = {
	[P in keyof ConnectOptsMap]: Protocol<T> extends P
		? ConnectOptsMap[P]
		: never;
}[keyof ConnectOptsMap];

export type HttpProxyAgentOptions<T> = ConnectOpts<T> & http.AgentOptions;

interface HttpProxyAgentClientRequest extends http.ClientRequest {
	outputData?: {
		data: string;
	}[];
	_header?: string | null;
	_implicitHeader(): void;
}

function isHTTPS(protocol?: string | null): boolean {
	return typeof protocol === 'string' ? /^https:?$/i.test(protocol) : false;
}

/**
 * The `HttpProxyAgent` implements an HTTP Agent subclass that connects
 * to the specified "HTTP proxy server" in order to proxy HTTP requests.
 */
export class HttpProxyAgent<Uri extends string> extends Agent {
	static protocols = ['http', 'https'] as const;

	readonly proxy: URL;
	connectOpts: net.TcpNetConnectOpts & tls.ConnectionOptions;

	get secureProxy() {
		return isHTTPS(this.proxy.protocol);
	}

	constructor(proxy: Uri | URL, opts?: HttpProxyAgentOptions<Uri>) {
		super(opts);
		this.proxy = typeof proxy === 'string' ? new URL(proxy) : proxy;
		debug('Creating new HttpProxyAgent instance: %o', this.proxy.href);

		// Trim off the brackets from IPv6 addresses
		const host = (this.proxy.hostname || this.proxy.host).replace(
			/^\[|\]$/g,
			''
		);
		const port = this.proxy.port
			? parseInt(this.proxy.port, 10)
			: this.secureProxy
			? 443
			: 80;
		this.connectOpts = {
			...opts,
			host,
			port,
		};
	}

	async connect(
		req: HttpProxyAgentClientRequest,
		opts: AgentConnectOpts
	): Promise<net.Socket> {
		const { proxy } = this;

		const protocol = opts.secureEndpoint ? 'https:' : 'http:';
		const hostname = req.getHeader('host') || 'localhost';
		const base = `${protocol}//${hostname}`;
		const url = new URL(req.path, base);
		if (opts.port !== 80) {
			url.port = String(opts.port);
		}

		// Change the `http.ClientRequest` instance's "path" field
		// to the absolute path of the URL that will be requested.
		req.path = String(url);

		// Inject the `Proxy-Authorization` header if necessary.
		req._header = null;
		if (proxy.username || proxy.password) {
			const auth = `${decodeURIComponent(
				proxy.username
			)}:${decodeURIComponent(proxy.password)}`;
			req.setHeader(
				'Proxy-Authorization',
				`Basic ${Buffer.from(auth).toString('base64')}`
			);
		}

		if (!req.hasHeader('proxy-connection')) {
			req.setHeader(
				'Proxy-Connection',
				this.keepAlive ? 'Keep-Alive' : 'close'
			);
		}

		// Create a socket connection to the proxy server.
		let socket: net.Socket;
		if (this.secureProxy) {
			debug('Creating `tls.Socket`: %o', this.connectOpts);
			socket = tls.connect(this.connectOpts);
		} else {
			debug('Creating `net.Socket`: %o', this.connectOpts);
			socket = net.connect(this.connectOpts);
		}

		// At this point, the http ClientRequest's internal `_header` field
		// might have already been set. If this is the case then we'll need
		// to re-generate the string since we just changed the `req.path`.
		let first: string;
		let endOfHeaders: number;
		debug('Regenerating stored HTTP header string for request');
		req._implicitHeader();
		if (req.outputData && req.outputData.length > 0) {
			// Node >= 12
			debug(
				'Patching connection write() output buffer with updated header'
			);
			first = req.outputData[0].data;
			endOfHeaders = first.indexOf('\r\n\r\n') + 4;
			req.outputData[0].data =
				req._header + first.substring(endOfHeaders);
			debug('Output buffer: %o', req.outputData[0].data);
		}

		// Wait for the socket's `connect` event, so that this `callback()`
		// function throws instead of the `http` request machinery. This is
		// important for i.e. `PacProxyAgent` which determines a failed proxy
		// connection via the `callback()` function throwing.
		await once(socket, 'connect');

		return socket;
	}
}
