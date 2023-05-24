import * as net from 'net';
import * as tls from 'tls';
import * as http from 'http';
import type { Duplex } from 'stream';

export * from './helpers';

interface HttpConnectOpts extends net.TcpNetConnectOpts {
	secureEndpoint: false;
	protocol?: string;
}

interface HttpsConnectOpts extends tls.ConnectionOptions {
	secureEndpoint: true;
	protocol?: string;
	port: number;
}

export type AgentConnectOpts = HttpConnectOpts | HttpsConnectOpts;

const INTERNAL = Symbol('AgentBaseInternalState');

interface InternalState {
	defaultPort?: number;
	protocol?: string;
	currentSocket?: Duplex;
}

export abstract class Agent extends http.Agent {
	private [INTERNAL]: InternalState;

	// Set by `http.Agent` - missing from `@types/node`
	options!: Partial<net.TcpNetConnectOpts & tls.ConnectionOptions>;
	keepAlive!: boolean;

	constructor(opts?: http.AgentOptions) {
		super(opts);
		this[INTERNAL] = {};
	}

	abstract connect(
		req: http.ClientRequest,
		options: AgentConnectOpts
	): Promise<Duplex | http.Agent> | Duplex | http.Agent;

	/**
	 * Determine whether this is an `http` or `https` request.
	 */
	isSecureEndpoint(options?: AgentConnectOpts): boolean {
		if (options) {
			// First check the `secureEndpoint` property explicitly, since this
			// means that a parent `Agent` is "passing through" to this instance.
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			if (typeof (options as any).secureEndpoint === 'boolean') {
				return options.secureEndpoint;
			}

			// If no explicit `secure` endpoint, check if `protocol` property is
			// set. This will usually be the case since using a full string URL
			// or `URL` instance should be the most common usage.
			if (typeof options.protocol === 'string') {
				return options.protocol === 'https:';
			}
		}

		// Finally, if no `protocol` property was set, then fall back to
		// checking the stack trace of the current call stack, and try to
		// detect the "https" module.
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

	createSocket(
		req: http.ClientRequest,
		options: AgentConnectOpts,
		cb: (err: Error | null, s?: Duplex) => void
	) {
		const connectOpts = {
			...options,
			secureEndpoint: this.isSecureEndpoint(options),
		};
		Promise.resolve()
			.then(() => this.connect(req, connectOpts))
			.then((socket) => {
				if (socket instanceof http.Agent) {
					// @ts-expect-error `addRequest()` isn't defined in `@types/node`
					return socket.addRequest(req, connectOpts);
				}
				this[INTERNAL].currentSocket = socket;
				// @ts-expect-error `createSocket()` isn't defined in `@types/node`
				super.createSocket(req, options, cb);
			}, cb);
	}

	createConnection(): Duplex {
		const socket = this[INTERNAL].currentSocket;
		this[INTERNAL].currentSocket = undefined;
		if (!socket) {
			throw new Error(
				'No socket was returned in the `connect()` function'
			);
		}
		return socket;
	}

	get defaultPort(): number {
		return (
			this[INTERNAL].defaultPort ??
			(this.protocol === 'https:' ? 443 : 80)
		);
	}

	set defaultPort(v: number) {
		if (this[INTERNAL]) {
			this[INTERNAL].defaultPort = v;
		}
	}

	get protocol(): string {
		return (
			this[INTERNAL].protocol ??
			(this.isSecureEndpoint() ? 'https:' : 'http:')
		);
	}

	set protocol(v: string) {
		if (this[INTERNAL]) {
			this[INTERNAL].protocol = v;
		}
	}
}
