import * as net from 'net';
import * as tls from 'tls';
import * as http from 'http';
import * as crypto from 'crypto';
import once from '@tootallnate/once';
import createDebug from 'debug';
import { Readable } from 'stream';
import { format } from 'url';
import { Agent, AgentConnectOpts, toBuffer } from 'agent-base';
import { HttpProxyAgent, HttpProxyAgentOptions } from 'http-proxy-agent';
import { HttpsProxyAgent, HttpsProxyAgentOptions } from 'https-proxy-agent';
import { SocksProxyAgent, SocksProxyAgentOptions } from 'socks-proxy-agent';
import {
	getUri,
	protocols as gProtocols,
	ProtocolOpts as GetUriOptions,
} from "get-uri";
import {
	createPacResolver,
	FindProxyForURL,
	PacResolverOptions,
} from 'pac-resolver';

const debug = createDebug('pac-proxy-agent');

type Protocols = keyof typeof gProtocols;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type Protocol<T> = T extends `pac+${infer P}:${infer _}`
	? P
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	: T extends `${infer P}:${infer _}`
	? P
	: never;

export type PacProxyAgentOptions<T> = PacResolverOptions &
	GetUriOptions<`${Protocol<T>}:`> &
	HttpProxyAgentOptions<''> &
	HttpsProxyAgentOptions<''> &
	SocksProxyAgentOptions & {
		fallbackToDirect?: boolean;
	};

/**
 * The `PacProxyAgent` class.
 *
 * A few different "protocol" modes are supported (supported protocols are
 * backed by the `get-uri` module):
 *
 *   - "pac+data", "data" - refers to an embedded "data:" URI
 *   - "pac+file", "file" - refers to a local file
 *   - "pac+ftp", "ftp" - refers to a file located on an FTP server
 *   - "pac+http", "http" - refers to an HTTP endpoint
 *   - "pac+https", "https" - refers to an HTTPS endpoint
 */
export class PacProxyAgent<Uri extends string> extends Agent {
	static readonly protocols: `pac-${Protocols}`[] = [
		"pac-data",
		"pac-file",
		"pac-ftp",
		"pac-http",
		"pac-https",
	];

	uri: URL;
	opts: PacProxyAgentOptions<Uri>;
	cache?: Readable;
	resolver?: FindProxyForURL;
	resolverHash: string;
	resolverPromise?: Promise<FindProxyForURL>;

	constructor(uri: Uri | URL, opts?: PacProxyAgentOptions<Uri>) {
		super();

		// Strip the "pac+" prefix
		const uriStr = typeof uri === "string" ? uri : uri.href;
		this.uri = new URL(uriStr.replace(/^pac\+/i, ""));

		debug("Creating PacProxyAgent with URI %o", this.uri.href);

		// @ts-expect-error Not sure why TS is complaining here…
		this.opts = { ...opts };
		this.cache = undefined;
		this.resolver = undefined;
		this.resolverHash = "";
		this.resolverPromise = undefined;

		// For `PacResolver`
		if (!this.opts.filename) {
			this.opts.filename = this.uri.href;
		}
	}

	private clearResolverPromise = (): void => {
		this.resolverPromise = undefined;
	};

	/**
	 * Loads the PAC proxy file from the source if necessary, and returns
	 * a generated `FindProxyForURL()` resolver function to use.
	 *
	 * @api private
	 */
	private getResolver(): Promise<FindProxyForURL> {
		if (!this.resolverPromise) {
			this.resolverPromise = this.loadResolver();
			this.resolverPromise.then(
				this.clearResolverPromise,
				this.clearResolverPromise
			);
		}
		return this.resolverPromise;
	}

	private async loadResolver(): Promise<FindProxyForURL> {
		try {
			// (Re)load the contents of the PAC file URI
			const code = await this.loadPacFile();

			// Create a sha1 hash of the JS code
			const hash = crypto.createHash("sha1").update(code).digest("hex");

			if (this.resolver && this.resolverHash === hash) {
				debug(
					"Same sha1 hash for code - contents have not changed, reusing previous proxy resolver"
				);
				return this.resolver;
			}

			// Cache the resolver
			debug("Creating new proxy resolver instance");
			this.resolver = createPacResolver(code, this.opts);

			// Store that sha1 hash for future comparison purposes
			this.resolverHash = hash;

			return this.resolver;
		} catch (err: unknown) {
			if (
				this.resolver &&
				(err as NodeJS.ErrnoException).code === "ENOTMODIFIED"
			) {
				debug(
					"Got ENOTMODIFIED response, reusing previous proxy resolver"
				);
				return this.resolver;
			}
			throw err;
		}
	}

	/**
	 * Loads the contents of the PAC proxy file.
	 *
	 * @api private
	 */
	private async loadPacFile(): Promise<string> {
		debug("Loading PAC file: %o", this.uri);

		const rs = await getUri(this.uri, { ...this.opts, cache: this.cache });
		debug("Got `Readable` instance for URI");
		this.cache = rs;

		const buf = await toBuffer(rs);
		debug("Read %o byte PAC file from URI", buf.length);

		return buf.toString("utf8");
	}

	/**
	 * Called when the node-core HTTP client library is creating a new HTTP request.
	 */
	async connect(
		req: http.ClientRequest,
		opts: AgentConnectOpts
	): Promise<http.Agent | net.Socket> {
		const { secureEndpoint } = opts;

		// First, get a generated `FindProxyForURL()` function,
		// either cached or retrieved from the source
		const resolver = await this.getResolver();

		// Calculate the `url` parameter
		const defaultPort = secureEndpoint ? 443 : 80;
		let path = req.path;
		let search: string | null = null;
		const firstQuestion = path.indexOf("?");
		if (firstQuestion !== -1) {
			search = path.substring(firstQuestion);
			path = path.substring(0, firstQuestion);
		}

		const urlOpts = {
			...opts,
			protocol: secureEndpoint ? "https:" : "http:",
			pathname: path,
			search,

			// need to use `hostname` instead of `host` otherwise `port` is ignored
			hostname: opts.host,
			host: null,
			href: null,

			// set `port` to null when it is the protocol default port (80 / 443)
			port: defaultPort === opts.port ? null : opts.port,
		};
		const url = format(urlOpts);

		debug("url: %o", url);
		let result = await resolver(url);

		// Default to "DIRECT" if a falsey value was returned (or nothing)
		if (!result) {
			result = "DIRECT";
		}

		const proxies = String(result)
			.trim()
			.split(/\s*;\s*/g)
			.filter(Boolean);

		if (this.opts.fallbackToDirect && !proxies.includes("DIRECT")) {
			proxies.push("DIRECT");
		}

		for (const proxy of proxies) {
			let agent: Agent | null = null;
			let socket: net.Socket | null = null;
			const [type, target] = proxy.split(/\s+/);
			debug("Attempting to use proxy: %o", proxy);

			if (type === "DIRECT") {
				// Direct connection to the destination endpoint
				socket = secureEndpoint ? tls.connect(opts) : net.connect(opts);
			} else if (type === "SOCKS" || type === "SOCKS5") {
				// Use a SOCKSv5h proxy
				agent = new SocksProxyAgent(`socks://${target}`, this.opts);
			} else if (type === "SOCKS4") {
				// Use a SOCKSv4a proxy
				agent = new SocksProxyAgent(`socks4a://${target}`, this.opts);
			} else if (
				type === "PROXY" ||
				type === "HTTP" ||
				type === "HTTPS"
			) {
				// Use an HTTP or HTTPS proxy
				// http://dev.chromium.org/developers/design-documents/secure-web-proxy
				const proxyURL = `${
					type === "HTTPS" ? "https" : "http"
				}://${target}`;
				if (secureEndpoint) {
					agent = new HttpsProxyAgent(proxyURL, this.opts);
				} else {
					agent = new HttpProxyAgent(proxyURL, this.opts);
				}
			}

			try {
				if (socket) {
					// "DIRECT" connection, wait for connection confirmation
					await once(socket, "connect");
					req.emit("proxy", { proxy, socket });
					return socket;
				}
				if (agent) {
					const s = await agent.connect(req, opts);
					if (!(s instanceof net.Socket)) {
						throw new Error(
							"Expected a `net.Socket` to be returned from agent"
						);
					}
					req.emit("proxy", { proxy, socket: s });
					return s;
				}
				throw new Error(`Could not determine proxy type for: ${proxy}`);
			} catch (err) {
				debug("Got error for proxy %o: %o", proxy, err);
				req.emit("proxy", { proxy, error: err });
			}
		}

		throw new Error(
			`Failed to establish a socket connection to proxies: ${JSON.stringify(
				proxies
			)}`
		);
	}
}