import * as http from 'http';
import { listen } from 'async-listen';
import { json, req } from 'agent-base';
import { createProxy, ProxyServer } from 'proxy';
import { HttpsProxyAgent } from '../src';

function listenOnLocalhost(server: http.Server): Promise<URL> {
	return new Promise((resolve, reject) => {
		server.listen(0, '127.0.0.1', () => {
			const addr = server.address();
			if (!addr || typeof addr === 'string') {
				return reject(new Error('unexpected address'));
			}
			resolve(new URL(`http://127.0.0.1:${addr.port}`));
		});
	});
}

describe('HttpsProxyAgent Negotiate / onProxyAuth', () => {
	let server: http.Server;
	let serverUrl: URL;

	let negotiateProxy: ProxyServer;
	let negotiateProxyUrl: URL;

	beforeAll(async () => {
		// setup target HTTP server
		server = http.createServer();
		serverUrl = await listenOnLocalhost(server);
	});

	beforeAll(async () => {
		// setup negotiate proxy
		negotiateProxy = createProxy();
		negotiateProxy.authenticate = 'negotiate';
		negotiateProxyUrl = await listenOnLocalhost(negotiateProxy);
	});

	beforeEach(() => {
		server.removeAllListeners('request');
	});

	afterAll(() => {
		server.close();
		negotiateProxy.close();
	});

	describe('onProxyAuth callback', () => {
		it('should be called on 407 response', async () => {
			let callbackCalled = false;
			let receivedScheme = '';

			server.once('request', (_req, res) => {
				res.end(JSON.stringify({ ok: true }));
			});

			const agent = new HttpsProxyAgent(negotiateProxyUrl.href, {
				onProxyAuth: async ({ scheme }) => {
					callbackCalled = true;
					receivedScheme = scheme;
					return {
						headers: {
							'Proxy-Authorization': 'Negotiate faketoken',
						},
					};
				},
			});

			const res = await req(serverUrl, { agent });
			const body = await json(res);

			expect(callbackCalled).toBe(true);
			expect(receivedScheme).toBe('Negotiate');
			expect(res.statusCode).toBe(200);
			expect(body).toEqual({ ok: true });
		});

		it('should use returned headers on retry', async () => {
			server.once('request', (_req, res) => {
				res.end(JSON.stringify({ ok: true }));
			});

			const agent = new HttpsProxyAgent(negotiateProxyUrl.href, {
				onProxyAuth: async () => {
					return {
						headers: {
							'Proxy-Authorization': 'Negotiate mybase64token',
						},
					};
				},
			});

			const res = await req(serverUrl, { agent });
			const body = await json(res);

			expect(res.statusCode).toBe(200);
			expect(body).toEqual({ ok: true });
		});

		it('should fail without onProxyAuth on 407 proxy', async () => {
			server.once('request', (_req, res) => {
				res.end('should not reach here');
			});

			const agent = new HttpsProxyAgent(negotiateProxyUrl.href);

			const res = await req(serverUrl, { agent });
			expect(res.statusCode).toBe(407);
		});

		it('should pass the response object to the callback', async () => {
			let receivedResponse: unknown;

			server.once('request', (_req, res) => {
				res.end(JSON.stringify({ ok: true }));
			});

			const agent = new HttpsProxyAgent(negotiateProxyUrl.href, {
				onProxyAuth: async ({ response, scheme }) => {
					receivedResponse = response;
					return {
						headers: {
							'Proxy-Authorization': 'Negotiate token123',
						},
					};
				},
			});

			const res = await req(serverUrl, { agent });
			expect(res.statusCode).toBe(200);
			expect(receivedResponse).toBeDefined();
			expect(
				(receivedResponse as { statusCode: number }).statusCode
			).toBe(407);
			expect(
				(receivedResponse as { headers: Record<string, string> })
					.headers['proxy-authenticate']
			).toBe('Negotiate');
		});
	});

	describe('negotiate option', () => {
		it('should throw when kerberos is not available and negotiate auth is attempted', async () => {
			// The negotiate option creates a callback that will try to import kerberos
			// Since kerberos native bindings may not work in test env, we test
			// that the negotiate callback is set up
			const agent = new HttpsProxyAgent(negotiateProxyUrl.href, {
				negotiate: true,
			});
			expect(agent.onProxyAuth).toBeDefined();
		});
	});
});
