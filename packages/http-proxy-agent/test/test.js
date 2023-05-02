const fs = require('fs');
const url = require('url');
const http = require('http');
const https = require('https');
const assert = require('assert');
const { createProxy } = require('proxy');
const { Agent } = require('agent-base');
const { HttpProxyAgent } = require('../');

const sleep = (n) => new Promise((r) => setTimeout(r, n));

describe('HttpProxyAgent', () => {
	let server;
	let serverPort;

	let proxy;
	let proxyPort;

	let sslProxy;
	let sslProxyPort;

	before((done) => {
		// setup HTTP proxy server
		proxy = createProxy();
		proxy.listen(() => {
			proxyPort = proxy.address().port;
			done();
		});
	});

	before((done) => {
		// setup target HTTP server
		server = http.createServer();
		server.listen(() => {
			serverPort = server.address().port;
			done();
		});
	});

	beforeEach(() => {
		server.removeAllListeners('request');
	});

	before((done) => {
		// setup SSL HTTP proxy server
		let options = {
			key: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.key`),
			cert: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.pem`),
		};
		sslProxy = createProxy(https.createServer(options));
		sslProxy.listen(() => {
			sslProxyPort = sslProxy.address().port;
			done();
		});
	});

	// shut down test HTTP server
	after((done) => {
		proxy.once('close', () => {
			done();
		});
		proxy.close();
	});

	after((done) => {
		server.once('close', () => {
			done();
		});
		server.close();
	});

	after((done) => {
		sslProxy.once('close', () => {
			done();
		});
		sslProxy.close();
	});

	describe('constructor', () => {
		it('should throw an Error if no "proxy" argument is given', () => {
			assert.throws(() => {
				new HttpProxyAgent();
			});
		});
		it('should accept a "string" proxy argument', () => {
			let agent = new HttpProxyAgent(`http://127.0.0.1:${proxyPort}`);
			assert.equal('127.0.0.1', agent.proxy.hostname);
			assert.equal(proxyPort, agent.proxy.port);
		});
		it('should accept a `URL` instance proxy argument', () => {
			let agent = new HttpProxyAgent(
				new URL(`http://127.0.0.1:${proxyPort}`)
			);
			assert.equal('127.0.0.1', agent.proxy.hostname);
			assert.equal(proxyPort, agent.proxy.port);
		});
		it('should set a `defaultPort` property', () => {
			let opts = url.parse(`http://127.0.0.1:${proxyPort}`);
			let agent = new HttpProxyAgent(opts);
			assert.equal(80, agent.defaultPort);
		});
		describe('secureProxy', () => {
			it('should be `false` when "http:" protocol is used', () => {
				let agent = new HttpProxyAgent(`http://127.0.0.1:${proxyPort}`);
				assert.equal(false, agent.secureProxy);
			});
			it('should be `true` when "https:" protocol is used', () => {
				let agent = new HttpProxyAgent(
					`https://127.0.0.1:${proxyPort}`
				);
				assert.equal(true, agent.secureProxy);
			});
		});
	});

	describe('"http" module', () => {
		it('should work over an HTTP proxy', (done) => {
			// set HTTP "request" event handler for this test
			server.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});

			let proxy = `http://127.0.0.1:${proxyPort}`;
			let agent = new HttpProxyAgent(proxy);

			let opts = url.parse(`http://127.0.0.1:${serverPort}`);
			opts.agent = agent;

			http.get(opts, (res) => {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', (b) => {
					data += b;
				});
				res.on('end', () => {
					data = JSON.parse(data);
					assert.equal(`127.0.0.1:${serverPort}`, data.host);
					assert('via' in data);
					done();
				});
			});
		});
		it('should work over an HTTPS proxy', (done) => {
			// set HTTP "request" event handler for this test
			server.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});

			let proxy =
				process.env.HTTPS_PROXY ||
				process.env.https_proxy ||
				`https://127.0.0.1:${sslProxyPort}`;
			let agent = new HttpProxyAgent(proxy, {
				rejectUnauthorized: false,
			});
			assert.equal(true, agent.secureProxy);

			http.get(`http://127.0.0.1:${serverPort}`, { agent }, (res) => {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', (b) => {
					data += b;
				});
				res.on('end', () => {
					data = JSON.parse(data);
					assert.equal(`127.0.0.1:${serverPort}`, data.host);
					assert('via' in data);
					done();
				});
			});
		});
		it('should proxy the query string of the request path', (done) => {
			// set HTTP "request" event handler for this test
			server.once('request', (req, res) => {
				res.end(
					JSON.stringify({
						url: req.url,
					})
				);
			});

			let proxy = `http://127.0.0.1:${proxyPort}`;
			let agent = new HttpProxyAgent(proxy);

			let opts = url.parse(
				`http://127.0.0.1:${serverPort}/test?foo=bar&1=2`
			);
			opts.agent = agent;

			http.get(opts, (res) => {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', (b) => {
					data += b;
				});
				res.on('end', () => {
					data = JSON.parse(data);
					assert.equal('/test?foo=bar&1=2', data.url);
					done();
				});
			});
		});
		it('should receive the 407 authorization code on the `http.ClientResponse`', (done) => {
			// reject all requests
			proxy.authenticate = () => false;

			let proxyUri = `http://127.0.0.1:${proxyPort}`;
			let agent = new HttpProxyAgent(proxyUri);

			let opts = {};
			// `host` and `port` don't really matter since the proxy will reject anyways
			opts.host = '127.0.0.1';
			opts.port = 80;
			opts.agent = agent;

			http.get(opts, (res) => {
				assert.equal(407, res.statusCode);
				assert('proxy-authenticate' in res.headers);
				delete proxy.authenticate;
				done();
			});
		});
		it('should send the "Proxy-Authorization" request header', (done) => {
			// set a proxy authentication function for this test
			proxy.authenticate = (req) => {
				// username:password is "foo:bar"
				return (
					req.headers['proxy-authorization'] === 'Basic Zm9vOmJhcg=='
				);
			};

			// set HTTP "request" event handler for this test
			server.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});

			let proxyUri = `http://foo:bar@127.0.0.1:${proxyPort}`;
			let agent = new HttpProxyAgent(proxyUri);

			let opts = url.parse(`http://127.0.0.1:${serverPort}`);
			opts.agent = agent;

			http.get(opts, (res) => {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', (b) => {
					data += b;
				});
				res.on('end', () => {
					data = JSON.parse(data);
					assert.equal(`127.0.0.1:${serverPort}`, data.host);
					assert('via' in data);
					delete proxy.authenticate;
					done();
				});
			});
		});
		it('should emit an "error" event on the `http.ClientRequest` if the proxy does not exist', (done) => {
			// port 4 is a reserved, but "unassigned" port
			let proxyUri = 'http://127.0.0.1:4';
			let agent = new HttpProxyAgent(proxyUri);

			let opts = url.parse('http://nodejs.org');
			opts.agent = agent;

			let req = http.get(opts);
			req.once('error', (err) => {
				assert.equal('ECONNREFUSED', err.code);
				req.abort();
				done();
			});
		});
		it('should work after the first tick of the `http.ClientRequest` instance', (done) => {
			// set HTTP "request" event handler for this test
			server.once('request', (req, res) => {
				res.end(JSON.stringify(req.url));
			});

			let proxy = `http://127.0.0.1:${proxyPort}`;
			let httpProxyAgent = new HttpProxyAgent(proxy);

			// Defer the "connect()" function logic, since calling `req.end()`
			// before the socket is returned causes the HTTP header to be
			// generated *before* `HttpProxyAgent` can patch the `req.path`
			// property, making the header incorrect.
			class SleepAgent extends Agent {
				async connect(_req, opts) {
					assert.equal(opts.secureEndpoint, false);
					assert.equal(opts.protocol, 'http:');
					await sleep(10);
					return httpProxyAgent;
				}
			}
			const sleepAgent = new SleepAgent();

			http.get(
				`http://127.0.0.1:${serverPort}/test`,
				{ agent: sleepAgent },
				(res) => {
					let data = '';
					res.setEncoding('utf8');
					res.on('data', (b) => {
						data += b;
					});
					res.on('end', () => {
						data = JSON.parse(data);
						assert.equal('/test', data);
						done();
					});
				}
			);
		});
		it('should not send a port number for the default port', (done) => {
			server.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});
			let proxy = `http://127.0.0.1:${proxyPort}`;
			proxy = url.parse(proxy);
			let agent = new HttpProxyAgent(proxy);
			agent.defaultPort = serverPort;
			let opts = url.parse(`http://127.0.0.1:${serverPort}`);
			opts.agent = agent;
			http.get(opts, (res) => {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', (b) => {
					data += b;
				});
				res.on('end', () => {
					data = JSON.parse(data);
					assert.equal('127.0.0.1', data.host);
					done();
				});
			});
		});
	});
});
