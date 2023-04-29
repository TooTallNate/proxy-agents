import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import assert from 'assert';
import { json, req } from 'agent-base';
import { ProxyServer, createProxy } from 'proxy';
// @ts-expect-error no types
import socks from 'socksv5';
import { listen } from 'async-listen';
import { ProxyAgent } from '../src';

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

		describe('over "socks" proxy', () => {
			it('should work', async () => {
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
		});
	});
});
