import fs from 'fs';
import http from 'http';
import https from 'https';
import assert from 'assert';
import { once } from 'events';
import { listen } from 'async-listen';
import { json, req } from 'agent-base';
import { createProxy, ProxyServer } from 'proxy';
import { HttpsProxyAgent } from '../src';

const sslOptions = {
	key: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.key`),
	cert: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.pem`),
};

const testIf = (condition: boolean, ...args: Parameters<typeof test>) =>
	condition ? test(...args) : test.skip(...args);

describe('HttpsProxyAgent', () => {
	let server: http.Server;
	let serverUrl: URL;

	let sslServer: https.Server;
	let sslServerUrl: URL;

	let proxy: ProxyServer;
	let proxyUrl: URL;

	let sslProxy: ProxyServer;
	let sslProxyUrl: URL;

	beforeAll(async () => {
		// setup target HTTP server
		server = http.createServer();
		serverUrl = await listen(server) as URL;
	});

	beforeAll(async () => {
		// setup HTTP proxy server
		proxy = createProxy();
		proxyUrl = await listen(proxy) as URL;
	});

	beforeAll(async () => {
		// setup target HTTPS server
		sslServer = https.createServer(sslOptions);
		sslServerUrl = await listen(sslServer) as URL;
	});

	beforeAll(async () => {
		// setup SSL HTTP proxy server
		sslProxy = createProxy(https.createServer(sslOptions));
		sslProxyUrl = await listen(sslProxy) as URL;
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
			const agent = new HttpsProxyAgent(proxyUrl.href);
			assert.equal(proxyUrl.hostname, agent.proxy.hostname);
			assert.equal(proxyUrl.port, agent.proxy.port);
		});
		it('should accept a `URL` instance proxy argument', () => {
			const agent = new HttpsProxyAgent(proxyUrl);
			assert.equal(proxyUrl.hostname, agent.proxy.hostname);
			assert.equal(proxyUrl.port, agent.proxy.port);
		});
		describe('secureProxy', () => {
			it('should be `false` when "http:" protocol is used', () => {
				const agent = new HttpsProxyAgent(
					proxyUrl
				);
				assert.equal(false, agent.secureProxy);
			});
			it('should be `true` when "https:" protocol is used', () => {
				const agent = new HttpsProxyAgent(
					sslProxyUrl
				);
				assert.equal(true, agent.secureProxy);
			});
		});
	});

	describe('"http" module', () => {
		beforeEach(() => {
			delete proxy.authenticate;
		});

		it('should work over an HTTP proxy', async () => {
			server.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});

			const agent = new HttpsProxyAgent(proxyUrl);

			const res = await req(serverUrl, { agent });
			const body = await json(res);
			assert.equal(serverUrl.host, body.host);
		});

		it('should work over an HTTPS proxy', async () => {
			server.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});

			const agent = new HttpsProxyAgent(sslProxyUrl, {
				rejectUnauthorized: false,
			});

			const res = await req(serverUrl, { agent });
			const body = await json(res);
			assert.equal(serverUrl.host, body.host);
		});
		it('should receive the 407 authorization code on the `http.ClientResponse`', async () => {
			// reject all auth requests
			proxy.authenticate = () => false;

			const agent = new HttpsProxyAgent(proxyUrl);

			const res = await req('http://example.com', { agent });
			assert.equal(407, res.statusCode);
			assert('proxy-authenticate' in res.headers);
		});
		it('should not error if the proxy responds with 407 and the request is aborted', async () => {
			// reject all auth requests
			proxy.authenticate = () => false;

			const req = http.get(
				{
					agent: new HttpsProxyAgent(proxyUrl),
				},
				(res) => {
					assert.equal(407, res.statusCode);
					req.abort();
				}
			);

			await once(req, 'abort');
		});
		it('should emit an "end" event on the `http.IncomingMessage` if the proxy responds with non-200 status code', async () => {
			proxy.authenticate = () => false;

			const agent = new HttpsProxyAgent(proxyUrl);

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
				serverUrl,
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
		// Skipping these tests on older Node, since it fails with a strange error.
		// Possibly related to the `proxy` testing module.
		// The module does seem to work fine on an actual proxy though.
		const nodeVersion = parseFloat(process.versions.node);

		testIf(
			nodeVersion >= 18,
			'should work over an HTTP proxy',
			async () => {
				sslServer.once('request', (req, res) => {
					res.end(JSON.stringify(req.headers));
				});

				const agent = new HttpsProxyAgent(proxyUrl);

				const res = await req(sslServerUrl, {
					rejectUnauthorized: false,
					agent,
				});
				const body = await json(res);
				assert.equal(sslServerUrl.host, body.host);
			}
		);

		testIf(
			nodeVersion >= 18,
			'should work over an HTTPS proxy',
			async () => {
				sslServer.once('request', (req, res) => {
					res.end(JSON.stringify(req.headers));
				});

				const agent = new HttpsProxyAgent(sslProxyUrl, {
					rejectUnauthorized: false,
				});

				const res = await req(sslServerUrl, {
					agent,
					rejectUnauthorized: false,
				});
				const body = await json(res);
				assert.equal(sslServerUrl.host, body.host);
			}
		);

		testIf(
			nodeVersion >= 18,
			'should not send a port number for the default port',
			async () => {
				sslServer.once('request', (req, res) => {
					res.end(JSON.stringify(req.headers));
				});

				const agent = new HttpsProxyAgent(
					sslProxyUrl,
					{ rejectUnauthorized: false }
				);
				agent.defaultPort = parseInt(sslServerUrl.port, 10);

				const res = await req(sslServerUrl, {
					agent,
					rejectUnauthorized: false,
				});
				const body = await json(res);
				assert.equal(sslServerUrl.hostname, body.host);
			}
		);
	});
});
