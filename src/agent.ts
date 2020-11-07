import net from 'net';
import tls from 'tls';
import url from 'url';
import assert from 'assert';
import createDebug from 'debug';
import { OutgoingHttpHeaders } from 'http';
import { Agent, ClientRequest, RequestOptions } from 'agent-base';
import { HttpsProxyAgentOptions } from '.';
import parseProxyResponse from './parse-proxy-response';

const debug = createDebug('https-proxy-agent:agent');

/**
 * The `HttpsProxyAgent` implements an HTTP Agent subclass that connects to
 * the specified "HTTP(s) proxy server" in order to proxy HTTPS requests.
 *
 * Outgoing HTTP requests are first tunneled through the proxy server using the
 * `CONNECT` HTTP request method to establish a connection to the proxy server,
 * and then the proxy server connects to the destination target and issues the
 * HTTP request from the proxy server.
 *
 * `https:` requests have their socket connection upgraded to TLS once
 * the connection to the proxy server has been established.
 *
 * @api public
 */
export default class HttpsProxyAgent extends Agent {
	private secureProxy: boolean;
	private proxy: HttpsProxyAgentOptions;

	constructor(_opts: string | HttpsProxyAgentOptions) {
		let opts: HttpsProxyAgentOptions;
		if (typeof _opts === 'string') {
			opts = url.parse(_opts);
		} else {
			opts = _opts;
		}
		if (!opts) {
			throw new Error(
				'an HTTP(S) proxy server `host` and `port` must be specified!'
			);
		}
		debug('creating new HttpsProxyAgent instance: %o', opts);
		super(opts);

		const proxy: HttpsProxyAgentOptions = { ...opts };

		// If `true`, then connect to the proxy server over TLS.
		// Defaults to `false`.
		this.secureProxy = opts.secureProxy || isHTTPS(proxy.protocol);

		// Prefer `hostname` over `host`, and set the `port` if needed.
		proxy.host = proxy.hostname || proxy.host;
		if (typeof proxy.port === 'string') {
			proxy.port = parseInt(proxy.port, 10);
		}
		if (!proxy.port && proxy.host) {
			proxy.port = this.secureProxy ? 443 : 80;
		}

		// ALPN is supported by Node.js >= v5.
		// attempt to negotiate http/1.1 for proxy servers that support http/2
		if (this.secureProxy && !('ALPNProtocols' in proxy)) {
			proxy.ALPNProtocols = ['http 1.1'];
		}

		if (proxy.host && proxy.path) {
			// If both a `host` and `path` are specified then it's most likely
			// the result of a `url.parse()` call... we need to remove the
			// `path` portion so that `net.connect()` doesn't attempt to open
			// that as a Unix socket file.
			delete proxy.path;
			delete proxy.pathname;
		}

		this.proxy = proxy;
	}

	/**
	 * Called when the node-core HTTP client library is creating a
	 * new HTTP request.
	 *
	 * @api protected
	 */
	async callback(
		req: ClientRequest,
		opts: RequestOptions
	): Promise<net.Socket> {
		const { proxy, secureProxy } = this;

		// Create a socket connection to the proxy server.
		let socket: net.Socket;
		if (secureProxy) {
			debug('Creating `tls.Socket`: %o', proxy);
			socket = tls.connect(proxy as tls.ConnectionOptions);
		} else {
			debug('Creating `net.Socket`: %o', proxy);
			socket = net.connect(proxy as net.NetConnectOpts);
		}

		const headers: OutgoingHttpHeaders = { ...proxy.headers };
		const hostname = `${opts.host}:${opts.port}`;
		let payload = `CONNECT ${hostname} HTTP/1.1\r\n`;

		// Inject the `Proxy-Authorization` header if necessary.
		if (proxy.auth) {
			headers['Proxy-Authorization'] = `Basic ${Buffer.from(
				proxy.auth
			).toString('base64')}`;
		}

		// The `Host` header should only include the port
		// number when it is not the default port.
		let { host, port, secureEndpoint } = opts;
		if (!isDefaultPort(port, secureEndpoint)) {
			host += `:${port}`;
		}
		headers.Host = host;

		headers.Connection = 'close';
		for (const name of Object.keys(headers)) {
			payload += `${name}: ${headers[name]}\r\n`;
		}

		const proxyResponsePromise = parseProxyResponse(socket);

		socket.write(`${payload}\r\n`);

		const {
			statusCode,
			buffered
		} = await proxyResponsePromise;

		if (statusCode === 200) {
			req.once('socket', resume);

			if (opts.secureEndpoint) {
				// The proxy is connecting to a TLS server, so upgrade
				// this socket connection to a TLS connection.
				debug('Upgrading socket connection to TLS');
				const servername = opts.servername || opts.host;
				return tls.connect({
					...omit(opts, 'host', 'hostname', 'path', 'port'),
					socket,
					servername
				});
			}

			return socket;
		}

		// Some other status code that's not 200... need to re-play the HTTP
		// header "data" events onto the socket once the HTTP machinery is
		// attached so that the node core `http` can parse and handle the
		// error status code.

		// Close the original socket, and a new "fake" socket is returned
		// instead, so that the proxy doesn't get the HTTP request
		// written to it (which may contain `Authorization` headers or other
		// sensitive data).
		//
		// See: https://hackerone.com/reports/541502
		socket.destroy();

		const fakeSocket = new net.Socket({ writable: false });
		fakeSocket.readable = true;

		// Need to wait for the "socket" event to re-play the "data" events.
		req.once('socket', (s: net.Socket) => {
			debug('replaying proxy buffer for failed request');
			assert(s.listenerCount('data') > 0);

			// Replay the "buffered" Buffer onto the fake `socket`, since at
			// this point the HTTP module machinery has been hooked up for
			// the user.
			s.push(buffered);
			s.push(null);
		});

		return fakeSocket;
	}
}

function resume(socket: net.Socket | tls.TLSSocket): void {
	socket.resume();
}

function isDefaultPort(port: number, secure: boolean): boolean {
	return Boolean((!secure && port === 80) || (secure && port === 443));
}

function isHTTPS(protocol?: string | null): boolean {
	return typeof protocol === 'string' ? /^https:?$/i.test(protocol) : false;
}

function omit<T extends object, K extends [...(keyof T)[]]>(
	obj: T,
	...keys: K
): {
	[K2 in Exclude<keyof T, K[number]>]: T[K2];
} {
	const ret = {} as {
		[K in keyof typeof obj]: (typeof obj)[K];
	};
	let key: keyof typeof obj;
	for (key in obj) {
		if (!keys.includes(key)) {
			ret[key] = obj[key];
		}
	}
	return ret;
}
