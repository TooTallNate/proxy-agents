import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import assert from 'assert';
import { once } from 'events';
import { createProxy, ProxyServer } from 'proxy';
import { listen } from 'async-listen';
import { json, req } from 'agent-base';
import { HttpProxyAgent } from '../src';

describe('HttpProxyAgent', () => {
	let httpServer: http.Server;
	let httpServerUrl: URL;

	let proxy: ProxyServer;
	let proxyUrl: URL;

	let sslProxy: ProxyServer;
	let sslProxyUrl: URL;

	beforeAll(async () => {
		// setup HTTP proxy server
		proxy = createProxy();
		proxyUrl = await listen(proxy);
	});

	beforeAll(async () => {
		// setup target HTTP server
		httpServer = http.createServer();
		httpServerUrl = await listen(httpServer);
	});

	beforeAll(async () => {
		// setup SSL HTTP proxy server
		const options = {
			key: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.key`),
			cert: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.pem`),
		};
		sslProxy = createProxy(https.createServer(options));
		sslProxyUrl = await listen(sslProxy);
	});

	beforeEach(() => {
		httpServer.removeAllListeners('request');
		delete proxy.authenticate;
	});

	// shut down test HTTP server
	afterAll(() => {
		proxy.close();
		httpServer.close();
		sslProxy.close();
	});

	describe('constructor', () => {
		it('should accept a "string" proxy argument', () => {
			const agent = new HttpProxyAgent(proxyUrl.href);
			assert.equal(proxyUrl.hostname, agent.proxy.hostname);
			assert.equal(proxyUrl.port, agent.proxy.port);
		});
		it('should accept a `URL` instance proxy argument', () => {
			const agent = new HttpProxyAgent(proxyUrl);
			assert.equal(proxyUrl.hostname, agent.proxy.hostname);
			assert.equal(proxyUrl.port, agent.proxy.port);
		});
		it('should set a `defaultPort` property', () => {
			const agent = new HttpProxyAgent(proxyUrl);
			assert.equal(80, agent.defaultPort);
		});
		describe('secureProxy', () => {
			it('should be `false` when "http:" protocol is used', () => {
				const agent = new HttpProxyAgent(
					`http://127.0.0.1:${proxyUrl.port}`
				);
				assert.equal(false, agent.secureProxy);
			});
			it('should be `true` when "https:" protocol is used', () => {
				const agent = new HttpProxyAgent(
					`https://127.0.0.1:${proxyUrl.port}`
				);
				assert.equal(true, agent.secureProxy);
			});
		});
	});

	describe('"http" module', () => {
		it('should work over an HTTP proxy', async () => {
			// set HTTP "request" event handler for this test
			httpServer.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});

			const agent = new HttpProxyAgent(proxyUrl);
			const res = await req(httpServerUrl, { agent });
			const body = await json(res);
			expect(body.host).toEqual(httpServerUrl.host);
			assert('via' in body);
		});
		it('should work over an HTTPS proxy', async () => {
			// set HTTP "request" event handler for this test
			httpServer.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});

			const agent = new HttpProxyAgent(sslProxyUrl, {
				rejectUnauthorized: false,
			});

			const res = await req(httpServerUrl, { agent });
			const body = await json(res);
			expect(body.host).toEqual(httpServerUrl.host);
			expect(body).toHaveProperty('via');
		});
		it('should proxy the query string of the request path', async () => {
			// set HTTP "request" event handler for this test
			httpServer.once('request', (req, res) => {
				res.end(
					JSON.stringify({
						url: req.url,
					})
				);
			});

			const agent = new HttpProxyAgent(proxyUrl);

			const path = '/test?foo=bar&1=2';
			const res = await req(new URL(path, httpServerUrl), { agent });
			const body = await json(res);
			expect(body.url).toEqual(path);
		});
		it('should receive the 407 authorization code on the `http.ClientResponse`', async () => {
			// reject all requests
			proxy.authenticate = () => false;

			const agent = new HttpProxyAgent(proxyUrl);
			const res = await req('http://example.com', { agent });
			assert.equal(407, res.statusCode);
			assert('proxy-authenticate' in res.headers);
		});
		it('should send the "Proxy-Authorization" request header', async () => {
			// set a proxy authentication function for this test
			let gotAuth = false;
			proxy.authenticate = (req) => {
				gotAuth = true;
				// username:password is "foo:bar"
				return (
					req.headers['proxy-authorization'] === 'Basic Zm9vOmJhcg=='
				);
			};

			// set HTTP "request" event handler for this test
			httpServer.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});

			const authProxy = new URL(proxyUrl.href);
			authProxy.username = 'foo';
			authProxy.password = 'bar';
			const agent = new HttpProxyAgent(authProxy);

			const res = await req(httpServerUrl, { agent });
			const body = await json(res);
			expect(gotAuth).toEqual(true);
			expect(body.host).toEqual(httpServerUrl.host);
			expect(body).toHaveProperty('via');
		});
		it('should emit an "error" event on the `http.ClientRequest` if the proxy does not exist', async () => {
			// port 4 is a reserved, but "unassigned" port
			const agent = new HttpProxyAgent('http://127.0.0.1:4');

			let err: NodeJS.ErrnoException | undefined;
			try {
				await req('http://example.com', { agent });
			} catch (_err) {
				err = _err as NodeJS.ErrnoException;
			}
			assert(err);
			expect(err.code).toEqual('ECONNREFUSED');
		});

		it('should allow custom proxy "headers" object', async () => {
			httpServer.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});
			const agent = new HttpProxyAgent(proxyUrl, {
				headers: { Foo: 'bar' },
			});

			const res = await req(httpServerUrl, { agent });
			const body = await json(res);
			expect(body.foo).toEqual('bar');
		});

		it('should allow custom proxy "headers" function', async () => {
			let count = 1;
			httpServer.on('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});
			const agent = new HttpProxyAgent(proxyUrl, {
				headers: () => ({ number: count++ }),
			});

			const res = await req(httpServerUrl, { agent });
			const body = await json(res);
			expect(body.number).toEqual('1');

			const res2 = await req(httpServerUrl, { agent });
			const body2 = await json(res2);
			expect(body2.number).toEqual('2');
		});

		it('should not send a port number for the default port', async () => {
			httpServer.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});
			const agent = new HttpProxyAgent(proxyUrl);
			agent.defaultPort = +httpServerUrl.port;

			const res = await req(httpServerUrl, { agent });
			const body = await json(res);
			expect(body.host).toEqual(httpServerUrl.hostname);
		});

		it('should work with `keepAlive: true`', async () => {
			httpServer.on('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});

			const agent = new HttpProxyAgent(proxyUrl, { keepAlive: true });

			try {
				const res = await req(httpServerUrl, { agent });
				expect(res.headers.connection).toEqual('keep-alive');
				expect(res.statusCode).toEqual(200);
				res.resume();
				const s1 = res.socket;
				await once(s1, 'free');

				const res2 = await req(httpServerUrl, { agent });
				expect(res2.headers.connection).toEqual('keep-alive');
				expect(res2.statusCode).toEqual(200);
				res2.resume();
				const s2 = res2.socket;
				assert(s1 === s2);
				await once(s2, 'free');
			} finally {
				agent.destroy();
			}
		});
	});
});
