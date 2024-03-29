import * as net from 'net';
import * as tls from 'tls';
import * as http from 'http';
import { Agent as HttpsAgent } from 'https';
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

	// In order to support async signatures in `connect()` and Node's native
	// connection pooling in `http.Agent`, the array of sockets for each origin
	// has to be updated synchronously. This is so the length of the array is
	// accurate when `addRequest()` is next called. We achieve this by creating a
	// fake socket and adding it to `sockets[origin]` and incrementing
	// `totalSocketCount`.
	private incrementSockets(name: string) {
		// If `maxSockets` and `maxTotalSockets` are both Infinity then there is no
		// need to create a fake socket because Node.js native connection pooling
		// will never be invoked.
		if (this.maxSockets === Infinity && this.maxTotalSockets === Infinity) {
			return null;
		}
		// All instances of `sockets` are expected TypeScript errors. The
		// alternative is to add it as a private property of this class but that
		// will break TypeScript subclassing.
		if (!this.sockets[name]) {
			// @ts-expect-error `sockets` is readonly in `@types/node`
			this.sockets[name] = [];
		}
		const fakeSocket = new net.Socket({ writable: false });
		(this.sockets[name] as net.Socket[]).push(fakeSocket);
		// @ts-expect-error `totalSocketCount` isn't defined in `@types/node`
		this.totalSocketCount++;
		return fakeSocket;
	}

	private decrementSockets(name: string, socket: null | net.Socket) {
		if (!this.sockets[name] || socket === null) {
			return;
		}
		const sockets = this.sockets[name] as net.Socket[];
		const index = sockets.indexOf(socket);
		if (index !== -1) {
			sockets.splice(index, 1);
			// @ts-expect-error  `totalSocketCount` isn't defined in `@types/node`
			this.totalSocketCount--;
			if (sockets.length === 0) {
				// @ts-expect-error `sockets` is readonly in `@types/node`
				delete this.sockets[name];
			}
		}
	}

	// In order to properly update the socket pool, we need to call `getName()` on
	// the core `https.Agent` if it is a secureEndpoint.
	getName(options: AgentConnectOpts): string {
		const secureEndpoint =
			typeof options.secureEndpoint === 'boolean'
				? options.secureEndpoint
				: this.isSecureEndpoint(options);
		if (secureEndpoint) {
			// @ts-expect-error `getName()` isn't defined in `@types/node`
			return HttpsAgent.prototype.getName.call(this, options);
		}
		// @ts-expect-error `getName()` isn't defined in `@types/node`
		return super.getName(options);
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
		const name = this.getName(connectOpts);
		const fakeSocket = this.incrementSockets(name);
		Promise.resolve()
			.then(() => this.connect(req, connectOpts))
			.then(
				(socket) => {
					this.decrementSockets(name, fakeSocket);
					if (socket instanceof http.Agent) {
						// @ts-expect-error `addRequest()` isn't defined in `@types/node`
						return socket.addRequest(req, connectOpts);
					}
					this[INTERNAL].currentSocket = socket;
					// @ts-expect-error `createSocket()` isn't defined in `@types/node`
					super.createSocket(req, options, cb);
				},
				(err) => {
					this.decrementSockets(name, fakeSocket);
					cb(err);
				}
			);
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
