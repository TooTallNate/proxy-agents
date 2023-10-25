import assert from 'assert';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
// @ts-expect-error no types
import socks from 'socksv5';
import { listen } from 'async-listen';
import { ProxyServer, createProxy } from 'proxy';
import { req, json } from 'agent-base';
import { PacProxyAgent } from '../src';

const sslOptions = {
	key: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.key`),
	cert: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.pem`),
};

describe('PacProxyAgent', () => {
	// target servers
	let httpServer: http.Server;
	let httpServerUrl: URL;
	let httpsServer: https.Server;
	let httpsServerUrl: URL;

	// proxy servers
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let socksServer: any;
	let socksServerUrl: URL;
	let proxyServer: ProxyServer;
	let proxyServerUrl: URL;
	let proxyHttpsServer: ProxyServer;
	let proxyHttpsServerUrl: URL;

	beforeAll(async () => {
		// setup target HTTP server
		httpServer = http.createServer();
		httpServerUrl = await listen(httpServer);
	});

	beforeAll(async () => {
		// setup target SSL HTTPS server
		httpsServer = https.createServer(sslOptions);
		httpsServerUrl = await listen(httpsServer);
	});

	beforeAll(async () => {
		// setup SOCKS proxy server
		// @ts-expect-error no types for `socksv5`
		socksServer = socks.createServer(function (_info, accept) {
			accept();
		});
		await listen(socksServer);
		const port = socksServer.address().port;
		socksServerUrl = new URL(`socks://127.0.0.1:${port}`);
		socksServer.useAuth(socks.auth.None());
	});

	beforeAll(async () => {
		// setup HTTP proxy server
		proxyServer = createProxy();
		proxyServerUrl = await listen(proxyServer);
	});

	beforeAll(async () => {
		// setup SSL HTTPS proxy server
		proxyHttpsServer = createProxy(https.createServer(sslOptions));
		proxyHttpsServerUrl = await listen(proxyHttpsServer);
	});

	afterAll(() => {
		socksServer.close();
		httpServer.close();
		httpsServer.close();
		proxyServer.close();
		proxyHttpsServer.close();
	});

	beforeEach(() => {
		httpServer.removeAllListeners('request');
		httpsServer.removeAllListeners('request');
	});

	it('should allow a `sandbox` to be passed in', async () => {
		//this.slow(1000);

		function FindProxyForURL() {
			// @ts-expect-error `bar()` is passed in via `sandbox`
			throw new Error(foo() + bar());
		}

		function foo() {
			return 'hi';
		}

		function asyncBar() {
			return new Promise((r) => r('fooooo'));
		}
		asyncBar.async = true;

		const agent = new PacProxyAgent(
			`data:,${encodeURIComponent(FindProxyForURL.toString())}`,
			{
				sandbox: {
					foo,
					bar: asyncBar,
				},
			}
		);

		let err: Error | undefined;
		try {
			await req(httpServerUrl, { agent });
		} catch (_err) {
			err = _err as Error;
		}
		assert(err);
		assert.equal(err.message, 'hifooooo');
	});

	describe('constructor', () => {
		it('should accept a "string" proxy argument', () => {
			const agent = new PacProxyAgent('pac+ftp://example.com/proxy.pac');
			assert.equal('ftp://example.com/proxy.pac', agent.uri.href);
		});
		it('should accept a `URL` instance proxy argument', () => {
			const agent = new PacProxyAgent(
				new URL('pac+ftp://example.com/proxy.pac')
			);
			assert.equal('ftp://example.com/proxy.pac', agent.uri.href);
		});
	});

	describe('"http" module', () => {
		it('should work over an HTTP proxy', async () => {
			httpServer.once('request', function (req, res) {
				res.end(JSON.stringify(req.headers));
			});

			function FindProxyForURL() {
				return 'PROXY localhost:PORT;';
			}

			const uri = `data:,${encodeURIComponent(
				FindProxyForURL.toString().replace('PORT', proxyServerUrl.port)
			)}`;
			const agent = new PacProxyAgent(uri);

			const res = await req(new URL('/test', httpServerUrl), { agent });
			const data = await json(res);
			assert.equal(httpServerUrl.host, data.host);
			assert('via' in data);
		});

		it('should work over an HTTPS proxy', async () => {
			httpServer.once('request', function (req, res) {
				res.end(JSON.stringify(req.headers));
			});

			function FindProxyForURL() {
				return 'HTTPS localhost:PORT;';
			}

			const uri = `data:,${encodeURIComponent(
				FindProxyForURL.toString().replace(
					'PORT',
					proxyHttpsServerUrl.port
				)
			)}`;
			const agent = new PacProxyAgent(uri, { rejectUnauthorized: false });

			const res = await req(new URL('/test', httpServerUrl), { agent });
			const data = await json(res);
			assert.equal(httpServerUrl.host, data.host);
			assert('via' in data);
		});

		it('should work over a SOCKS proxy', async () => {
			httpServer.once('request', function (req, res) {
				res.end(JSON.stringify(req.headers));
			});

			function FindProxyForURL() {
				return 'SOCKS localhost:PORT;';
			}

			const uri = `data:,${encodeURIComponent(
				FindProxyForURL.toString().replace('PORT', socksServerUrl.port)
			)}`;
			const agent = new PacProxyAgent(uri);

			const res = await req(new URL('/test', httpServerUrl), { agent });
			const data = await json(res);
			assert.equal(httpServerUrl.host, data.host);
		});

		it('should fall back to the next proxy after one fails', async () => {
			let gotReq = false;
			httpServer.once('request', function (req, res) {
				res.end(JSON.stringify(req.headers));
				gotReq = true;
			});

			function FindProxyForURL() {
				return 'SOCKS bad-domain:8080; HTTP bad-domain:8080; HTTPS bad-domain:8080; DIRECT;';
			}

			const uri = `data:,${encodeURIComponent(String(FindProxyForURL))}`;
			const agent = new PacProxyAgent(uri);

			const r = req(new URL('/test', httpServerUrl), { agent });

			let proxyCount = 0;
			r.on('proxy', function ({ proxy, error, socket }) {
				proxyCount++;
				if (proxy === 'DIRECT') {
					assert(socket);
				} else {
					assert(error);
				}
			});

			const res = await r;
			const data = await json(res);
			assert.equal(httpServerUrl.host, data.host);
			assert.equal(proxyCount, 4);
			assert(gotReq);
		}, 10000); // This test is slow on Windows :/

		it('should support `fallbackToDirect` option', async () => {
			let gotReq = false;
			httpServer.once('request', function (req, res) {
				res.end(JSON.stringify(req.headers));
				gotReq = true;
			});

			function FindProxyForURL() {
				return 'SOCKS 127.0.0.1:4';
			}

			const uri = `data:,${encodeURIComponent(String(FindProxyForURL))}`;
			const agent = new PacProxyAgent(uri, { fallbackToDirect: true });

			const res = await req(new URL('/test', httpServerUrl), { agent });
			const data = await json(res);
			assert.equal(httpServerUrl.host, data.host);
			assert(gotReq);
		}, 10000); // This test is slow on Windows :/
	});

	describe('"https" module', () => {
		it('should work over an HTTP proxy', async () => {
			httpsServer.once('request', function (req, res) {
				res.end(JSON.stringify(req.headers));
			});

			function FindProxyForURL() {
				return 'PROXY localhost:PORT;';
			}

			const uri = `data:,${encodeURIComponent(
				FindProxyForURL.toString().replace('PORT', proxyServerUrl.port)
			)}`;
			const agent = new PacProxyAgent(uri);

			const res = await req(new URL('/test', httpsServerUrl), {
				agent,
				rejectUnauthorized: false,
			});
			const data = await json(res);
			assert.equal(httpsServerUrl.host, data.host);
		});

		it('should work over an HTTPS proxy', async () => {
			let gotReq = false;
			httpsServer.once('request', function (req, res) {
				gotReq = true;
				res.end(JSON.stringify(req.headers));
			});

			function FindProxyForURL() {
				return 'HTTPS localhost:PORT;';
			}

			const uri = `pac+data:,${encodeURIComponent(
				FindProxyForURL.toString().replace(
					'PORT',
					proxyHttpsServerUrl.port
				)
			)}`;
			const agent = new PacProxyAgent(uri, {
				rejectUnauthorized: false,
			});

			const res = await req(new URL('/test', httpsServerUrl), {
				agent,
				rejectUnauthorized: false,
			});
			const data = await json(res);
			assert.equal(httpsServerUrl.host, data.host);
			assert(gotReq);
		});

		it('should work over a SOCKS proxy', async () => {
			let gotReq = false;
			httpsServer.once('request', function (req, res) {
				gotReq = true;
				res.end(JSON.stringify(req.headers));
			});

			function FindProxyForURL() {
				return 'SOCKS localhost:PORT;';
			}

			const uri = `data:,${encodeURIComponent(
				FindProxyForURL.toString().replace('PORT', socksServerUrl.port)
			)}`;
			const agent = new PacProxyAgent(uri);

			const res = await req(new URL('/test', httpsServerUrl), {
				agent,
				rejectUnauthorized: false,
			});
			const data = await json(res);
			assert.equal(httpsServerUrl.host, data.host);
			assert(gotReq);
		});

		it('should fall back to the next proxy after one fails', async () => {
			let gotReq = false;
			httpsServer.once('request', function (req, res) {
				gotReq = true;
				res.end(JSON.stringify(req.headers));
			});

			function FindProxyForURL() {
				return 'SOCKS bad-domain:8080; HTTP bad-domain:8080; HTTPS bad-domain:8080; DIRECT;';
			}

			const uri = `data:,${encodeURIComponent(String(FindProxyForURL))}`;
			const agent = new PacProxyAgent(uri);
			const r = req(new URL('/test', httpsServerUrl), {
				agent,
				rejectUnauthorized: false,
			});

			let proxyCount = 0;
			r.on('proxy', function ({ proxy, error, socket }) {
				proxyCount++;
				if (proxy === 'DIRECT') {
					assert(socket);
				} else {
					assert(error);
				}
			});

			const res = await r;
			const data = await json(res);
			assert.equal(httpsServerUrl.host, data.host);
			assert.equal(proxyCount, 4);
			assert(gotReq);
		}, 10000); // This test is slow on Windows :/
	});
});
