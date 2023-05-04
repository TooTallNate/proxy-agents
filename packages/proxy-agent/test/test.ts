import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { once } from 'events';
import assert from 'assert';
import { json, req } from 'agent-base';
import { ProxyServer, createProxy } from 'proxy';
// @ts-expect-error no types
import socks from 'socksv5';
import { listen } from 'async-listen';
import { ProxyAgent } from '../src';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

const sslOptions = {
	key: fs.readFileSync(__dirname + '/ssl-cert-snakeoil.key'),
	cert: fs.readFileSync(__dirname + '/ssl-cert-snakeoil.pem'),
};

describe('ProxyAgent', () => {
	// target servers
	let httpServer: http.Server;
	let httpServerUrl: URL;
	let httpsServer: https.Server;
	let httpsServerUrl: URL;

	// proxy servers
	let httpProxyServer: ProxyServer;
	let httpProxyServerUrl: URL;
	let httpsProxyServer: ProxyServer;
	let httpsProxyServerUrl: URL;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let socksServer: any;
	let socksPort: number;

	beforeAll(async () => {
		// setup target HTTP server
		httpServer = http.createServer();
		httpServerUrl = (await listen(httpServer)) as URL;
	});

	beforeAll(async () => {
		// setup target SSL HTTPS server
		httpsServer = https.createServer(sslOptions);
		httpsServerUrl = (await listen(httpsServer)) as URL;
	});

	beforeAll(async () => {
		// setup SOCKS proxy server
		// @ts-expect-error no types
		socksServer = socks.createServer((_info, accept) => {
			accept();
		});
		socksServer.useAuth(socks.auth.None());
		await listen(socksServer);
		socksPort = socksServer.address().port;
	});

	beforeAll(async () => {
		// setup HTTP proxy server
		httpProxyServer = createProxy();
		httpProxyServerUrl = (await listen(httpProxyServer)) as URL;
	});

	beforeAll(async () => {
		// setup SSL HTTPS proxy server
		httpsProxyServer = createProxy(https.createServer(sslOptions));
		httpsProxyServerUrl = (await listen(httpsProxyServer)) as URL;
	});

	afterAll(() => {
		socksServer.close();
		httpServer.close();
		httpsServer.close();
		httpProxyServer.close();
		httpsProxyServer.close();
	});

	beforeEach(() => {
		delete process.env.HTTP_PROXY;
		delete process.env.HTTPS_PROXY;
		delete process.env.NO_PROXY;
		httpServer.removeAllListeners('request');
		httpsServer.removeAllListeners('request');
	});

	describe('"http" module', () => {
		it('should work with no proxy from env', async () => {
			httpServer.once('request', function (req, res) {
				res.end(JSON.stringify(req.headers));
			});

			// `NO_PROXY` should take precedence
			process.env.NO_PROXY = '*';
			process.env.HTTP_PROXY = httpProxyServerUrl.href;
			const agent = new ProxyAgent();

			const res = await req(new URL('/test', httpServerUrl), { agent });
			const body = await json(res);
			assert.equal(httpServerUrl.host, body.host);
			assert(!('via' in body));
		});

		it('should work over "http" proxy', async () => {
			httpServer.once('request', function (req, res) {
				res.end(JSON.stringify(req.headers));
			});

			process.env.HTTP_PROXY = httpProxyServerUrl.href;
			const agent = new ProxyAgent();

			const res = await req(new URL('/test', httpServerUrl), { agent });
			const body = await json(res);
			assert.equal(httpServerUrl.host, body.host);
			assert('via' in body);
		});

		it('should work over "https" proxy', async () => {
			httpServer.once('request', function (req, res) {
				res.end(JSON.stringify(req.headers));
			});

			process.env.HTTP_PROXY = httpsProxyServerUrl.href;
			const agent = new ProxyAgent({ rejectUnauthorized: false });

			const res = await req(new URL('/test', httpServerUrl), { agent });
			const body = await json(res);
			assert.equal(httpServerUrl.host, body.host);
		});

		it('should work over "socks" proxy', async () => {
			httpServer.once('request', function (req, res) {
				res.end(JSON.stringify(req.headers));
			});

			process.env.HTTP_PROXY = `socks://localhost:${socksPort}`;
			const agent = new ProxyAgent();

			const res = await req(new URL('/test', httpServerUrl), { agent });
			const body = await json(res);
			assert.equal(httpServerUrl.host, body.host);
		});

		it('should work with `keepAlive: true`', async () => {
			httpServer.on('request', function (req, res) {
				res.end(JSON.stringify(req.headers));
			});

			process.env.HTTP_PROXY = httpsProxyServerUrl.href;
			const agent = new ProxyAgent({
				keepAlive: true,
				rejectUnauthorized: false,
			});

			try {
				const res = await req(new URL('/test', httpServerUrl), {
					agent,
				});
				res.resume();
				expect(res.headers.connection).toEqual('keep-alive');
				const s1 = res.socket;
				await once(s1, 'free');

				const res2 = await req(new URL('/test', httpServerUrl), {
					agent,
				});
				res2.resume();
				expect(res2.headers.connection).toEqual('keep-alive');
				const s2 = res2.socket;
				assert(s1 === s2);

				await once(s2, 'free');
			} finally {
				agent.destroy();
			}
		});
	});

	describe('"https" module', () => {
		it('should work over "https" proxy', async () => {
			let gotReq = false;
			httpsServer.once('request', function (req, res) {
				res.end(JSON.stringify(req.headers));
				gotReq = true;
			});

			process.env.HTTPS_PROXY = httpsProxyServerUrl.href;
			const agent = new ProxyAgent({ rejectUnauthorized: false });

			const res = await req(new URL('/test', httpsServerUrl), {
				agent,
				rejectUnauthorized: false,
			});
			const body = await json(res);
			assert(gotReq);
			assert.equal(httpsServerUrl.host, body.host);
		});

		it('should work over "socks" proxy', async () => {
			let gotReq = false;
			httpsServer.once('request', function (req, res) {
				gotReq = true;
				res.end(JSON.stringify(req.headers));
			});

			process.env.HTTP_PROXY = `socks://localhost:${socksPort}`;
			const agent = new ProxyAgent();

			const res = await req(new URL('/test', httpsServerUrl), {
				agent,
				rejectUnauthorized: false,
			});
			const body = await json(res);
			assert(gotReq);
			assert.equal(httpsServerUrl.host, body.host);
		});

		it('should use `HttpProxyAgent` for "http" and `HttpsProxyAgent` for "https"', async () => {
			let gotHttpReq = false;
			httpServer.once('request', function (req, res) {
				res.end(JSON.stringify(req.headers));
				gotHttpReq = true;
			});

			let gotHttpsReq = false;
			httpsServer.once('request', function (req, res) {
				res.end(JSON.stringify(req.headers));
				gotHttpsReq = true;
			});

			process.env.ALL_PROXY = httpsProxyServerUrl.href;
			const agent = new ProxyAgent({ rejectUnauthorized: false });

			const res = await req(httpServerUrl, {
				agent,
			});
			const body = await json(res);
			assert(gotHttpReq);
			assert.equal(httpServerUrl.host, body.host);
			expect(agent.cache.size).toEqual(1);
			expect([...agent.cache.values()][0]).toBeInstanceOf(HttpProxyAgent);

			const res2 = await req(httpsServerUrl, {
				agent,
			});
			const body2 = await json(res2);
			assert(gotHttpsReq);
			assert.equal(httpsServerUrl.host, body2.host);
			expect(agent.cache.size).toEqual(2);
			expect([...agent.cache.values()][0]).toBeInstanceOf(
				HttpsProxyAgent
			);
		});
	});
});
