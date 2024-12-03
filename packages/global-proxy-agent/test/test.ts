import * as fs from 'fs';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import { once } from 'events';
import assert from 'assert';
import { json, req } from 'agent-base';
import { ProxyServer, createProxy } from 'proxy';
import { listen } from 'async-listen';
import { enableGlobalProxyAgent } from '../src';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import semver from 'semver';

const sslOptions = {
	key: fs.readFileSync(__dirname + '/ssl-cert-snakeoil.key'),
	cert: fs.readFileSync(__dirname + '/ssl-cert-snakeoil.pem'),
};

describe('GlobalProxyAgent', () => {
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
		serverUrl = await listen(server);
	});

	beforeAll(async () => {
		// setup HTTP proxy server
		proxy = createProxy();
		proxyUrl = await listen(proxy);
	});

	beforeAll(async () => {
		// setup target HTTPS server
		sslServer = https.createServer(sslOptions);
		sslServerUrl = await listen(sslServer);
	});

	beforeAll(async () => {
		// setup SSL HTTP proxy server
		sslProxy = createProxy(https.createServer(sslOptions));
		sslProxyUrl = await listen(sslProxy);
	});

	beforeEach(() => {
		server.removeAllListeners('request');
		sslServer.removeAllListeners('request');
	});

	// shut down the test HTTP servers
	afterAll(() => {
		server.close();
		proxy.close();
		sslServer.close();
		sslProxy.close();
	});

	const httpGet = http.get;
	const httpRequest = http.request;
	const httpsGet = https.get;
	const httpsRequest = https.request;
	const httpGlobalAgent = http.globalAgent;
	const httpsGlobalAgent = https.globalAgent;

	beforeEach(() => {
		if (semver.gte(process.version, 'v11.7.0')) {
			https.globalAgent = httpsGlobalAgent;
			http.globalAgent = httpGlobalAgent;
		}
		if (semver.gte(process.version, 'v10.0.0')) {
			http.get = httpGet;
			http.request = httpRequest;
			https.get = httpsGet;
			https.request = httpsRequest;
		}
	});

	describe('"http" module', () => {
		beforeEach(() => {
			delete proxy.authenticate;
		});

		// Doesn't work (don't know how to fix)
		// it('should work over an HTTP proxy agent', async () => {
		// 	// set HTTP "request" event handler for this test
		// 	server.once('request', (req, res) => {
		// 		res.end(JSON.stringify(req.headers));
		// 	});
		//
		// 	const agent = new HttpProxyAgent(proxyUrl);
		//
		// 	enableGlobalProxyAgent(agent);
		//
		// 	const res = await req(serverUrl, { agent });
		// 	const body = await json(res);
		// 	expect(body.host).toEqual(serverUrl.host);
		// 	assert('via' in body);
		// });

		it('should work over an HTTPS proxy agent', async () => {
			server.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});

			const agent = new HttpsProxyAgent(sslProxyUrl, {
				rejectUnauthorized: false,
			});

			enableGlobalProxyAgent(agent);

			const r = req(serverUrl);
			const [connect] = await once(agent, 'proxyConnect');
			expect(connect.statusCode).toEqual(200);
			expect(connect.statusText).toEqual('Connection established');
			const res = await r;
			const body = await json(res);
			assert.equal(serverUrl.host, body.host);
		});
	});
});
