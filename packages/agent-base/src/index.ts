import * as net from 'net';
import * as tls from 'tls';
import * as http from 'http';
import { Duplex } from 'stream';

export * from './helpers';

function isSecureEndpoint(): boolean {
	const { stack } = new Error();
	if (typeof stack !== 'string') return false;
	return stack
		.split('\n')
		.some(
			(l) =>
				l.indexOf('(https.js:') !== -1 ||
				l.indexOf('node:https:') !== -1
		);
}

interface HttpConnectOpts extends net.TcpNetConnectOpts {
	secureEndpoint: false;
}

interface HttpsConnectOpts extends tls.ConnectionOptions {
	port: number;
	secureEndpoint: true;
}

export type AgentConnectOpts = HttpConnectOpts | HttpsConnectOpts;

export abstract class Agent extends http.Agent {
	_defaultPort?: number;
	_protocol?: string;
	_currentSocket?: Duplex;

	// Set by `http.Agent` - missing from `@types/node`
	options!: Partial<net.TcpNetConnectOpts & tls.ConnectionOptions>;
	keepAlive!: boolean;

	constructor(opts?: http.AgentOptions) {
		super(opts);
		this._defaultPort = undefined;
		this._protocol = undefined;
	}

	abstract connect(
		req: http.ClientRequest,
		options: AgentConnectOpts
	): Promise<Duplex | http.Agent> | Duplex | http.Agent;

	createSocket(
		req: http.ClientRequest,
		options: AgentConnectOpts,
		cb: (err: Error | null, s?: Duplex) => void
	) {
		const o = {
			...options,
			secureEndpoint: options.secureEndpoint ?? isSecureEndpoint(),
		};
		Promise.resolve()
			.then(() => this.connect(req, o))
			.then((socket) => {
				if (socket instanceof http.Agent) {
					// @ts-expect-error `addRequest()` isn't defined in `@types/node`
					return socket.addRequest(req, o);
				}
				this._currentSocket = socket;
				// @ts-expect-error `createSocket()` isn't defined in `@types/node`
				super.createSocket(req, options, cb);
			}, cb);
	}

	createConnection(): Duplex {
		if (!this._currentSocket) {
			throw new Error('no socket');
		}
		return this._currentSocket;
	}

	get defaultPort(): number {
		if (typeof this._defaultPort === 'number') {
			return this._defaultPort;
		}
		const port = this.protocol === 'https:' ? 443 : 80;
		return port;
	}

	set defaultPort(v: number) {
		this._defaultPort = v;
	}

	get protocol(): string {
		if (typeof this._protocol === 'string') {
			return this._protocol;
		}
		const p = isSecureEndpoint() ? 'https:' : 'http:';
		return p;
	}

	set protocol(v: string) {
		this._protocol = v;
	}
}
