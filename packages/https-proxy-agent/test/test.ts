import fs from 'fs';
import http from 'http';
import https from 'https';
import assert from 'assert';
import { listen } from 'async-listen';
// @ts-expect-error "proxy" no types yet
import Proxy from 'proxy';
import { HttpsProxyAgent } from '../src';
import { once } from 'events';

const sslOptions = {
	key: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.key`),
	cert: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.pem`),
};

const req = (
	url: string,
	opts: https.RequestOptions
): Promise<http.IncomingMessage> =>
	new Promise((resolve, reject) => {
		(url.startsWith('https:') ? https : http)
			.request(url, opts, resolve)
			.once('error', reject)
			.end();
	});

function json(res: http.IncomingMessage): Promise<Record<string, string>> {
	return new Promise((resolve) => {
		let data = '';
		res.setEncoding('utf8');
		res.on('data', (b) => {
			data += b;
		});
		res.on('end', () => resolve(JSON.parse(data)));
	});
}

describe('HttpsProxyAgent', () => {
	let server: http.Server;
	let serverPort: number;

	let sslServer: https.Server;
	let sslServerPort: number;

	let proxy: http.Server;
	let proxyPort: number;

	let sslProxy: https.Server;
	let sslProxyPort: number;

	beforeAll(async () => {
		// setup target HTTP server
		server = http.createServer();
		await listen(server);
		// @ts-expect-error `port` is defined
		serverPort = server.address().port;
	});

	beforeAll(async () => {
		// setup HTTP proxy server
		proxy = Proxy();
		await listen(proxy);
		// @ts-expect-error `port` is defined
		proxyPort = proxy.address().port;
	});

	beforeAll(async () => {
		// setup target HTTPS server
		sslServer = https.createServer(sslOptions);
		await listen(sslServer);
		// @ts-expect-error `port` is defined
		sslServerPort = sslServer.address().port;
	});

	beforeAll(async () => {
		// setup SSL HTTP proxy server
		sslProxy = Proxy(https.createServer(sslOptions));
		await listen(sslProxy);
		// @ts-expect-error `port` is defined
		sslProxyPort = sslProxy.address().port;
	});

	// shut down the test HTTP servers
	afterAll(() => {
		server.close();
		proxy.close();
		sslServer.close();
		sslProxy.close();
	});

	describe('constructor', () => {
		it('should throw an Error if no "proxy" argument is given', () => {
			assert.throws(() => {
				new HttpsProxyAgent('');
			});
		});
		it('should accept a "string" proxy argument', () => {
			const agent = new HttpsProxyAgent(`http://localhost:${proxyPort}`);
			assert.equal('localhost', agent.proxy.hostname);
			assert.equal(proxyPort, agent.proxy.port);
		});
		it('should accept a `URL` instance proxy argument', () => {
			const agent = new HttpsProxyAgent(
				new URL(`http://localhost:${proxyPort}`)
			);
			assert.equal('localhost', agent.proxy.hostname);
			assert.equal(proxyPort, agent.proxy.port);
		});
		describe('secureProxy', () => {
			it('should be `false` when "http:" protocol is used', () => {
				const agent = new HttpsProxyAgent(
					`http://localhost:${proxyPort}`
				);
				assert.equal(false, agent.secureProxy);
			});
			it('should be `true` when "https:" protocol is used', () => {
				const agent = new HttpsProxyAgent(
					`https://localhost:${sslProxyPort}`
				);
				assert.equal(true, agent.secureProxy);
			});
		});
	});

	describe('"http" module', () => {
		beforeEach(() => {
			// @ts-expect-error ignore
			delete proxy.authenticate;
		});

		it('should work over an HTTP proxy', async () => {
			server.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});

			const proxy = `http://localhost:${proxyPort}`;
			const agent = new HttpsProxyAgent(proxy);

			const res = await req(`http://localhost:${serverPort}`, { agent });
			const body = await json(res);
			assert.equal(`localhost:${serverPort}`, body.host);
		});

		it('should work over an HTTPS proxy', async () => {
			server.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});

			const agent = new HttpsProxyAgent(
				`https://localhost:${sslProxyPort}`,
				{ rejectUnauthorized: false }
			);

			const res = await req(`http://localhost:${serverPort}`, { agent });
			const body = await json(res);
			assert.equal(`localhost:${serverPort}`, body.host);
		});
		it('should receive the 407 authorization code on the `http.ClientResponse`', async () => {
			// set a proxy authentication function for this test
			// @ts-expect-error ignore
			proxy.authenticate = function (_req, fn) {
				// reject all requests
				fn(null, false);
			};

			const proxyUri = `http://localhost:${proxyPort}`;
			const agent = new HttpsProxyAgent(proxyUri);

			const res = await req('http://example.com', { agent });
			assert.equal(407, res.statusCode);
			assert('proxy-authenticate' in res.headers);
		});
		it('should not error if the proxy responds with 407 and the request is aborted', async () => {
			// @ts-expect-error ignore
			proxy.authenticate = function (_req, fn) {
				fn(null, false);
			};

			const proxyUri = `http://localhost:${proxyPort}`;

			const req = http.get(
				{
					agent: new HttpsProxyAgent(proxyUri),
				},
				(res) => {
					assert.equal(407, res.statusCode);
					req.abort();
				}
			);

			await once(req, 'abort');
		});
		it('should emit an "end" event on the `http.IncomingMessage` if the proxy responds with non-200 status code', async () => {
			// @ts-expect-error ignore
			proxy.authenticate = function (_req, fn) {
				fn(null, false);
			};

			const agent = new HttpsProxyAgent(`http://localhost:${proxyPort}`);

			const res = await req('http://example.com', {
				agent,
			});
			assert.equal(407, res.statusCode);

			res.resume();
			await once(res, 'end');
		});

		it('should emit an "error" event on the `http.ClientRequest` if the proxy does not exist', async () => {
			// port 4 is a reserved, but "unassigned" port
			const agent = new HttpsProxyAgent('http://localhost:4');

			let err: NodeJS.ErrnoException | undefined;
			try {
				await req('http://nodejs.org', { agent });
			} catch (_err) {
				err = _err as NodeJS.ErrnoException;
			}
			assert(err);
			assert.equal('ECONNREFUSED', err.code);
		});

		it('should allow custom proxy "headers"', async () => {
			const agent = new HttpsProxyAgent(
				`http://localhost:${serverPort}`,
				{
					headers: {
						Foo: 'bar',
					},
				}
			);

			const connectPromise = once(server, 'connect');

			http.get({ agent });

			const [req, socket] = await connectPromise;
			assert.equal('CONNECT', req.method);
			assert.equal('bar', req.headers.foo);
			socket.destroy();
		});
	});

	describe('"https" module', () => {
		it.skip('should work over an HTTP proxy', async () => {
			sslServer.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});

			const proxy = `http://localhost:${proxyPort}`;
			const agent = new HttpsProxyAgent(proxy);

			const res = await req(`https://localhost:${sslServerPort}`, {
				rejectUnauthorized: false,
				agent,
			});
			const body = await json(res);
			assert.equal(`localhost:${sslServerPort}`, body.host);
		});

		it.skip('should work over an HTTPS proxy', async () => {
			sslServer.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});

			const proxy = `https://localhost:${sslProxyPort}`;
			const agent = new HttpsProxyAgent(proxy, {
				rejectUnauthorized: false,
			});

			const res = await req(`https://localhost:${sslServerPort}`, {
				agent,
				rejectUnauthorized: false,
			});
			const body = await json(res);
			assert.equal(`localhost:${sslServerPort}`, body.host);
		});

		it.skip('should not send a port number for the default port', async () => {
			sslServer.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});

			const agent = new HttpsProxyAgent(
				`https://localhost:${sslProxyPort}`,
				{ rejectUnauthorized: false }
			);
			agent.defaultPort = sslServerPort;

			const res = await req(`https://localhost:${sslServerPort}`, {
				agent,
				rejectUnauthorized: false,
			});
			const body = await json(res);
			assert.equal('localhost', body.host);
		});
	});
});
