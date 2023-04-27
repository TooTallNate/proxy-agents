let fs = require('fs');
let url = require('url');
let http = require('http');
let https = require('https');
let assert = require('assert');
let Proxy = require('proxy');
let { HttpsProxyAgent } = require('../');

describe('HttpsProxyAgent', () => {
	let server;
	let serverPort;

	let sslServer;
	let sslServerPort;

	let proxy;
	let proxyPort;

	let sslProxy;
	let sslProxyPort;

	before((done) => {
		// setup target HTTP server
		server = http.createServer();
		server.listen(() => {
			serverPort = server.address().port;
			done();
		});
	});

	before((done) => {
		// setup HTTP proxy server
		proxy = Proxy();
		proxy.listen(() => {
			proxyPort = proxy.address().port;
			done();
		});
	});

	before((done) => {
		// setup target HTTPS server
		let options = {
			key: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.key`),
			cert: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.pem`),
		};
		sslServer = https.createServer(options);
		sslServer.listen(() => {
			sslServerPort = sslServer.address().port;
			done();
		});
	});

	before((done) => {
		// setup SSL HTTP proxy server
		let options = {
			key: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.key`),
			cert: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.pem`),
		};
		sslProxy = Proxy(https.createServer(options));
		sslProxy.listen(() => {
			sslProxyPort = sslProxy.address().port;
			done();
		});
	});

	// shut down test HTTP server
	after((done) => {
		server.once('close', () => {
			done();
		});
		server.close();
	});

	after((done) => {
		proxy.once('close', () => {
			done();
		});
		proxy.close();
	});

	after((done) => {
		sslServer.once('close', () => {
			done();
		});
		sslServer.close();
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
				new HttpsProxyAgent();
			});
		});
		it('should accept a "string" proxy argument', () => {
			let agent = new HttpsProxyAgent(`http://localhost:${proxyPort}`);
			assert.equal('localhost', agent.proxy.hostname);
			assert.equal(proxyPort, agent.proxy.port);
		});
		it('should accept a `URL` instance proxy argument', () => {
			let agent = new HttpsProxyAgent(
				new URL(`http://localhost:${proxyPort}`)
			);
			assert.equal('localhost', agent.proxy.hostname);
			assert.equal(proxyPort, agent.proxy.port);
		});
		describe('secureProxy', () => {
			it('should default to `false`', () => {
				let agent = new HttpsProxyAgent({ port: proxyPort });
				assert.equal(false, agent.secureProxy);
			});
			it('should be `false` when "http:" protocol is used', () => {
				let agent = new HttpsProxyAgent({
					port: proxyPort,
					protocol: 'http:',
				});
				assert.equal(false, agent.secureProxy);
			});
			it('should be `true` when "https:" protocol is used', () => {
				let agent = new HttpsProxyAgent({
					port: proxyPort,
					protocol: 'https:',
				});
				assert.equal(true, agent.secureProxy);
			});
			it('should be `true` when "https" protocol is used', () => {
				let agent = new HttpsProxyAgent({
					port: proxyPort,
					protocol: 'https',
				});
				assert.equal(true, agent.secureProxy);
			});
		});
	});

	describe('"http" module', () => {
		beforeEach(() => {
			delete proxy.authenticate;
		});

		it('should work over an HTTP proxy', (done) => {
			server.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});

			let proxy = `http://localhost:${proxyPort}`;
			let agent = new HttpsProxyAgent(proxy);

			let opts = url.parse(`http://localhost:${serverPort}`);
			opts.agent = agent;

			let req = http.get(opts, (res) => {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', (b) => {
					data += b;
				});
				res.on('end', () => {
					data = JSON.parse(data);
					assert.equal(`localhost:${serverPort}`, data.host);
					done();
				});
			});
			req.once('error', done);
		});
		it('should work over an HTTPS proxy', (done) => {
			server.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});

			let agent = new HttpsProxyAgent(
				`https://localhost:${sslProxyPort}`,
				{ rejectUnauthorized: false }
			);

			let opts = url.parse(`http://localhost:${serverPort}`);
			opts.agent = agent;

			http.get(opts, (res) => {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', (b) => {
					data += b;
				});
				res.on('end', () => {
					data = JSON.parse(data);
					assert.equal(`localhost:${serverPort}`, data.host);
					done();
				});
			});
		});
		it('should receive the 407 authorization code on the `http.ClientResponse`', (done) => {
			// set a proxy authentication function for this test
			proxy.authenticate = function (req, fn) {
				// reject all requests
				fn(null, false);
			};

			let proxyUri = `http://localhost:${proxyPort}`;
			let agent = new HttpsProxyAgent(proxyUri);

			let opts = {};
			// `host` and `port` don't really matter since the proxy will reject anyways
			opts.host = 'localhost';
			opts.port = 80;
			opts.agent = agent;

			http.get(opts, (res) => {
				assert.equal(407, res.statusCode);
				assert('proxy-authenticate' in res.headers);
				done();
			});
		});
		it('should not error if the proxy responds with 407 and the request is aborted', (done) => {
			proxy.authenticate = function (req, fn) {
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

			req.on('abort', done);
		});
		it('should emit an "end" event on the `http.IncomingMessage` if the proxy responds with non-200 status code', (done) => {
			proxy.authenticate = function (req, fn) {
				fn(null, false);
			};

			const proxyUri = `http://localhost:${proxyPort}`;

			http.get(
				{
					agent: new HttpsProxyAgent(proxyUri),
				},
				(res) => {
					assert.equal(407, res.statusCode);

					res.resume();
					res.on('end', done);
				}
			);
		});
		it('should emit an "error" event on the `http.ClientRequest` if the proxy does not exist', (done) => {
			// port 4 is a reserved, but "unassigned" port
			let proxyUri = 'http://localhost:4';
			let agent = new HttpsProxyAgent(proxyUri);

			let opts = url.parse('http://nodejs.org');
			opts.agent = agent;

			let req = http.get(opts);
			req.once('error', (err) => {
				assert.equal('ECONNREFUSED', err.code);
				req.abort();
				done();
			});
		});

		it('should allow custom proxy "headers"', (done) => {
			server.once('connect', (req, socket) => {
				assert.equal('CONNECT', req.method);
				assert.equal('bar', req.headers.foo);
				socket.destroy();
				done();
			});

			let agent = new HttpsProxyAgent(`http://localhost:${serverPort}`, {
				headers: {
					Foo: 'bar',
				},
			});

			let opts = {};
			// `host` and `port` don't really matter since the proxy will reject anyways
			opts.host = 'localhost';
			opts.port = 80;
			opts.agent = agent;

			http.get(opts);
		});
	});

	describe('"https" module', () => {
		it('should work over an HTTP proxy', (done) => {
			sslServer.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});

			let proxy = `http://localhost:${proxyPort}`;
			let agent = new HttpsProxyAgent(proxy);

			https.get(
				`https://localhost:${sslServerPort}`,
				{ rejectUnauthorized: false, agent },
				(res) => {
					let data = '';
					res.setEncoding('utf8');
					res.on('data', (b) => {
						data += b;
					});
					res.on('end', () => {
						data = JSON.parse(data);
						assert.equal(`localhost:${sslServerPort}`, data.host);
						done();
					});
				}
			);
		});

		it('should work over an HTTPS proxy', (done) => {
			sslServer.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});

			let proxy = `https://localhost:${sslProxyPort}`;
			let agent = new HttpsProxyAgent(proxy, {
				rejectUnauthorized: false,
			});

			https.get(
				`https://localhost:${sslServerPort}`,
				{ agent, rejectUnauthorized: false },
				(res) => {
					let data = '';
					res.setEncoding('utf8');
					res.on('data', (b) => {
						data += b;
					});
					res.on('end', () => {
						data = JSON.parse(data);
						assert.equal(`localhost:${sslServerPort}`, data.host);
						done();
					});
				}
			);
		});

		it('should not send a port number for the default port', (done) => {
			sslServer.once('request', (req, res) => {
				res.end(JSON.stringify(req.headers));
			});

			let agent = new HttpsProxyAgent(
				`https://localhost:${sslProxyPort}`,
				{ rejectUnauthorized: false }
			);
			agent.defaultPort = sslServerPort;

			let opts = url.parse(`https://localhost:${sslServerPort}`);
			opts.agent = agent;
			opts.rejectUnauthorized = false;

			https.get(opts, (res) => {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', (b) => {
					data += b;
				});
				res.on('end', () => {
					data = JSON.parse(data);
					assert.equal('localhost', data.host);
					done();
				});
			});
		});
	});
});
