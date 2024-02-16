import assert from 'assert';
import * as https from 'https';
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import { URL } from 'url';
import dns2 from 'dns2';
// @ts-expect-error no types
import socks from 'socksv5';
import CacheableLookup from 'cacheable-lookup';
import { listen } from 'async-listen';
import { req, json } from 'agent-base';
import { SocksProxyAgent } from '../src';
import { once } from 'events';

describe('SocksProxyAgent', () => {
	let httpServer: http.Server;
	let httpServerUrl: URL;
	let httpsServer: https.Server;
	let httpsServerUrl: URL;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let socksServer: any;
	let socksServerUrl: URL;
	let socksServerHost: string | null = null;

	beforeEach(async () => {
		// setup SOCKS proxy server
		// @ts-expect-error no types for `socksv5`
		socksServer = socks.createServer(function (_info, accept) {
			accept();
		});
		await listen(socksServer, 0, socksServerHost ?? '127.0.0.1');
		const { port, family, address } = socksServer.address();
		socksServerUrl = new URL(
			`socks://${family === 'IPv6' ? 'localhost' : address}:${port}`
		);
		socksServer.useAuth(socks.auth.None());
	});

	afterEach(() => {
		socksServer.close();
	});

	beforeAll(async () => {
		// setup target HTTP server
		httpServer = http.createServer();
		httpServerUrl = await listen(httpServer);
	});

	beforeAll(async () => {
		// setup target SSL HTTPS server
		const options = {
			key: fs.readFileSync(
				path.resolve(__dirname, 'ssl-cert-snakeoil.key')
			),
			cert: fs.readFileSync(
				path.resolve(__dirname, 'ssl-cert-snakeoil.pem')
			),
		};
		httpsServer = https.createServer(options);
		httpsServerUrl = await listen(httpsServer);
	});

	afterAll(() => {
		httpServer.close();
		httpsServer.close();
	});

	beforeEach(() => {
		httpServer.removeAllListeners('request');
		httpsServer.removeAllListeners('request');
	});

	describe('constructor', () => {
		it('should accept a "string" proxy argument', () => {
			const agent = new SocksProxyAgent(socksServerUrl.href);
			assert.equal(socksServerUrl.hostname, agent.proxy.host);
			assert.equal(+socksServerUrl.port, agent.proxy.port);
		});
		it('should accept a `new URL()` result object argument', () => {
			const agent = new SocksProxyAgent(socksServerUrl);
			assert.equal(socksServerUrl.hostname, agent.proxy.host);
			assert.equal(+socksServerUrl.port, agent.proxy.port);
		});
		it('should respect `timeout` option during connection to socks server', async () => {
			const agent = new SocksProxyAgent(socksServerUrl, { timeout: 1 });

			let err: Error | undefined;
			try {
				await req('http://example.com', { agent });
			} catch (_err) {
				err = _err as Error;
			}
			assert(err);
			assert.equal(err.message, 'Proxy connection timed out');
		});
	});

	describe('ipv6 host', () => {
		beforeAll(() => {
			socksServerHost = '::1';
		});
		afterAll(() => {
			socksServerHost = null;
		});

		it('should connect over ipv6 socket', async () => {
			httpServer.once('request', (req, res) => res.end());

			const res = await req(new URL('/foo', httpServerUrl), {
				agent: new SocksProxyAgent(socksServerUrl, { socketOptions: { family: 6 } }),
			});
			assert(res);
		});

		it('should refuse connection over ipv4 socket', async () => {
			let err: Error | undefined;
			try {
				await req(new URL('/foo', httpServerUrl), {
					agent: new SocksProxyAgent(socksServerUrl, { socketOptions: { family: 4 } }),
				});
			} catch (_err) {
				err = _err as Error;
			}
			assert(err);
			assert.equal(err.message, `connect ECONNREFUSED 127.0.0.1:${socksServerUrl.port}`);
		});
	});

	describe('"http" module', () => {
		it('should work against an HTTP endpoint', async () => {
			httpServer.once('request', function (req, res) {
				assert.equal('/foo', req.url);
				res.statusCode = 404;
				res.end(JSON.stringify(req.headers));
			});

			const res = await req(new URL('/foo', httpServerUrl), {
				agent: new SocksProxyAgent(socksServerUrl),
				headers: { foo: 'bar' },
			});
			assert.equal(404, res.statusCode);

			const body = await json(res);
			assert.equal('bar', body.foo);
		});
	});

	describe('"https" module', () => {
		it('should work against an HTTPS endpoint', async () => {
			httpsServer.once('request', function (req, res) {
				assert.equal('/foo', req.url);
				res.statusCode = 404;
				res.end(JSON.stringify(req.headers));
			});

			const agent = new SocksProxyAgent(socksServerUrl);

			const res = await req(
				`https://127.0.0.1:${httpsServerUrl.port}/foo`,
				{
					agent,
					rejectUnauthorized: false,
					headers: { foo: 'bar' },
				}
			);
			assert.equal(404, res.statusCode);

			const body = await json(res);
			assert.equal('bar', body.foo);
		});
	});

	describe('Custom lookup option', () => {
		let dnsServer: ReturnType<typeof dns2.createServer>;
		let dnsQueries: { type: string; name: string }[];

		beforeAll(async () => {
			dnsQueries = [];

			// A custom DNS server that always replies with 127.0.0.1:
			dnsServer = dns2.createServer({
				udp: true,
				handle: (request, send) => {
					const response =
						dns2.Packet.createResponseFromRequest(request);
					const [question] = request.questions;
					const { name } = question;

					dnsQueries.push({
						// @ts-expect-error meh
						type: question.type,
						name: question.name,
					});

					response.answers.push({
						name,
						type: dns2.Packet.TYPE.A,
						class: dns2.Packet.CLASS.IN,
						ttl: 300,
						address: '127.0.0.1',
					});
					send(response);
				},
			});
			dnsServer.listen({ udp: 5333 });
			await once(dnsServer, 'listening');
		});

		afterAll(() => {
			dnsServer.close();
		});

		it("should use a requests's custom lookup function with socks5", async () => {
			httpServer.once('request', function (req, res) {
				assert.equal('/foo', req.url);
				res.statusCode = 404;
				res.end();
			});

			const agent = new SocksProxyAgent(
				socksServerUrl.href.replace('socks', 'socks5')
			);

			try {
				await req(
					`http://non-existent-domain.test:${httpServerUrl.port}/foo`,
					{
						agent,
						lookup(hostname, _opts, callback) {
							if (hostname === 'non-existent-domain.test') {
								// @ts-expect-error meh
								callback(null, '127.0.0.1');
								return;
							}
							// @ts-expect-error meh
							callback(new Error('Bad domain'));
						},
					}
				);
			} catch (err) {
				console.log(err);
			}
		});

		it('should support caching DNS requests', async () => {
			httpServer.on('request', function (req, res) {
				res.statusCode = 200;
				res.end();
			});

			const agent = new SocksProxyAgent(
				socksServerUrl.href.replace('socks', 'socks5')
			);

			const cacheableLookup = new CacheableLookup();
			cacheableLookup.servers = ['127.0.0.1:5333'];

			// No DNS queries made initially
			assert.deepEqual(dnsQueries, []);

			const res = await req(
				`http://test-domain.test:${httpServerUrl.port}/foo`,
				// @ts-expect-error meh
				{ agent, lookup: cacheableLookup.lookup }
			);
			assert.equal(200, res.statusCode);

			// Initial DNS query for first request
			assert.deepEqual(dnsQueries, [
				{ name: 'test-domain.test', type: dns2.Packet.TYPE.A },
				{ name: 'test-domain.test', type: dns2.Packet.TYPE.AAAA },
			]);

			const res2 = await req(
				`http://test-domain.test:${httpServerUrl.port}/foo`,
				// @ts-expect-error meh
				{ agent, lookup: cacheableLookup.lookup }
			);
			assert.equal(200, res2.statusCode);

			// Still the same. No new DNS queries, so the response was cached
			assert.deepEqual(dnsQueries, [
				{ name: 'test-domain.test', type: dns2.Packet.TYPE.A },
				{
					name: 'test-domain.test',
					type: dns2.Packet.TYPE.AAAA,
				},
			]);
		});
	});
});
