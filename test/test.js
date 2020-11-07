/**
 * Module dependencies.
 */

let fs = require('fs');
let url = require('url');
let http = require('http');
let https = require('https');
let assert = require('assert');
let Proxy = require('proxy');
let HttpsProxyAgent = require('../');

describe('HttpsProxyAgent', function() {
	let server;
	let serverPort;

	let sslServer;
	let sslServerPort;

	let proxy;
	let proxyPort;

	let sslProxy;
	let sslProxyPort;

	before(function(done) {
		// setup target HTTP server
		server = http.createServer();
		server.listen(function() {
			serverPort = server.address().port;
			done();
		});
	});

	before(function(done) {
		// setup HTTP proxy server
		proxy = Proxy();
		proxy.listen(function() {
			proxyPort = proxy.address().port;
			done();
		});
	});

	before(function(done) {
		// setup target HTTPS server
		let options = {
			key: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.key`),
			cert: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.pem`)
		};
		sslServer = https.createServer(options);
		sslServer.listen(function() {
			sslServerPort = sslServer.address().port;
			done();
		});
	});

	before(function(done) {
		// setup SSL HTTP proxy server
		let options = {
			key: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.key`),
			cert: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.pem`)
		};
		sslProxy = Proxy(https.createServer(options));
		sslProxy.listen(function() {
			sslProxyPort = sslProxy.address().port;
			done();
		});
	});

	// shut down test HTTP server
	after(function(done) {
		server.once('close', function() {
			done();
		});
		server.close();
	});

	after(function(done) {
		proxy.once('close', function() {
			done();
		});
		proxy.close();
	});

	after(function(done) {
		sslServer.once('close', function() {
			done();
		});
		sslServer.close();
	});

	after(function(done) {
		sslProxy.once('close', function() {
			done();
		});
		sslProxy.close();
	});

	describe('constructor', function() {
		it('should throw an Error if no "proxy" argument is given', function() {
			assert.throws(function() {
				new HttpsProxyAgent();
			});
		});
		it('should accept a "string" proxy argument', function() {
			let agent = new HttpsProxyAgent(`http://localhost:${proxyPort}`);
			assert.equal('localhost', agent.proxy.host);
			assert.equal(proxyPort, agent.proxy.port);
		});
		it('should accept a `url.parse()` result object argument', function() {
			let opts = url.parse(`http://localhost:${proxyPort}`);
			let agent = new HttpsProxyAgent(opts);
			assert.equal('localhost', agent.proxy.host);
			assert.equal(proxyPort, agent.proxy.port);
		});
		describe('secureProxy', function() {
			it('should default to `false`', function() {
				let agent = new HttpsProxyAgent({ port: proxyPort });
				assert.equal(false, agent.secureProxy);
			});
			it('should be `false` when "http:" protocol is used', function() {
				let agent = new HttpsProxyAgent({
					port: proxyPort,
					protocol: 'http:'
				});
				assert.equal(false, agent.secureProxy);
			});
			it('should be `true` when "https:" protocol is used', function() {
				let agent = new HttpsProxyAgent({
					port: proxyPort,
					protocol: 'https:'
				});
				assert.equal(true, agent.secureProxy);
			});
			it('should be `true` when "https" protocol is used', function() {
				let agent = new HttpsProxyAgent({
					port: proxyPort,
					protocol: 'https'
				});
				assert.equal(true, agent.secureProxy);
			});
		});
	});

	describe('"http" module', function() {
		beforeEach(function() {
			delete proxy.authenticate;
		});

		it('should work over an HTTP proxy', function(done) {
			server.once('request', function(req, res) {
				res.end(JSON.stringify(req.headers));
			});

			let proxy =
				process.env.HTTP_PROXY ||
				process.env.http_proxy ||
				`http://localhost:${proxyPort}`;
			let agent = new HttpsProxyAgent(proxy);

			let opts = url.parse(`http://localhost:${serverPort}`);
			opts.agent = agent;

			let req = http.get(opts, function(res) {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', function(b) {
					data += b;
				});
				res.on('end', function() {
					data = JSON.parse(data);
					assert.equal(`localhost:${serverPort}`, data.host);
					done();
				});
			});
			req.once('error', done);
		});
		it('should work over an HTTPS proxy', function(done) {
			server.once('request', function(req, res) {
				res.end(JSON.stringify(req.headers));
			});

			let proxy =
				process.env.HTTPS_PROXY ||
				process.env.https_proxy ||
				`https://localhost:${sslProxyPort}`;
			proxy = url.parse(proxy);
			proxy.rejectUnauthorized = false;
			let agent = new HttpsProxyAgent(proxy);

			let opts = url.parse(`http://localhost:${serverPort}`);
			opts.agent = agent;

			http.get(opts, function(res) {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', function(b) {
					data += b;
				});
				res.on('end', function() {
					data = JSON.parse(data);
					assert.equal(`localhost:${serverPort}`, data.host);
					done();
				});
			});
		});
		it('should receive the 407 authorization code on the `http.ClientResponse`', function(done) {
			// set a proxy authentication function for this test
			proxy.authenticate = function(req, fn) {
				// reject all requests
				fn(null, false);
			};

			let proxyUri =
				process.env.HTTP_PROXY ||
				process.env.http_proxy ||
				`http://localhost:${proxyPort}`;
			let agent = new HttpsProxyAgent(proxyUri);

			let opts = {};
			// `host` and `port` don't really matter since the proxy will reject anyways
			opts.host = 'localhost';
			opts.port = 80;
			opts.agent = agent;

			let req = http.get(opts, function(res) {
				assert.equal(407, res.statusCode);
				assert('proxy-authenticate' in res.headers);
				done();
			});
		});
		it('should not error if the proxy responds with 407 and the request is aborted', function(done) {
			proxy.authenticate = function(req, fn) {
				fn(null, false);
			};

			const proxyUri =
				process.env.HTTP_PROXY ||
				process.env.http_proxy ||
				`http://localhost:${proxyPort}`;

			const req = http.get(
				{
					agent: new HttpsProxyAgent(proxyUri)
				},
				function(res) {
					assert.equal(407, res.statusCode);
					req.abort();
				}
			);

			req.on('abort', done);
		});
		it('should emit an "end" event on the `http.IncomingMessage` if the proxy responds with non-200 status code', function(done) {
			proxy.authenticate = function(req, fn) {
				fn(null, false);
			};

			const proxyUri =
				process.env.HTTP_PROXY ||
				process.env.http_proxy ||
				`http://localhost:${proxyPort}`;

			const req = http.get(
				{
					agent: new HttpsProxyAgent(proxyUri)
				},
				function(res) {
					assert.equal(407, res.statusCode);

					res.resume();
					res.on('end', done);
				}
			);
		});
		it('should emit an "error" event on the `http.ClientRequest` if the proxy does not exist', function(done) {
			// port 4 is a reserved, but "unassigned" port
			let proxyUri = 'http://localhost:4';
			let agent = new HttpsProxyAgent(proxyUri);

			let opts = url.parse('http://nodejs.org');
			opts.agent = agent;

			let req = http.get(opts);
			req.once('error', function(err) {
				assert.equal('ECONNREFUSED', err.code);
				req.abort();
				done();
			});
		});

		it('should allow custom proxy "headers"', function(done) {
			server.once('connect', function(req, socket, head) {
				assert.equal('CONNECT', req.method);
				assert.equal('bar', req.headers.foo);
				socket.destroy();
				done();
			});

			let uri = `http://localhost:${serverPort}`;
			let proxyOpts = url.parse(uri);
			proxyOpts.headers = {
				Foo: 'bar'
			};
			let agent = new HttpsProxyAgent(proxyOpts);

			let opts = {};
			// `host` and `port` don't really matter since the proxy will reject anyways
			opts.host = 'localhost';
			opts.port = 80;
			opts.agent = agent;

			http.get(opts);
		});
	});

	describe('"https" module', function() {
		it('should work over an HTTP proxy', function(done) {
			sslServer.once('request', function(req, res) {
				res.end(JSON.stringify(req.headers));
			});

			let proxy =
				process.env.HTTP_PROXY ||
				process.env.http_proxy ||
				`http://localhost:${proxyPort}`;
			let agent = new HttpsProxyAgent(proxy);

			let opts = url.parse(`https://localhost:${sslServerPort}`);
			opts.rejectUnauthorized = false;
			opts.agent = agent;

			https.get(opts, function(res) {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', function(b) {
					data += b;
				});
				res.on('end', function() {
					data = JSON.parse(data);
					assert.equal(`localhost:${sslServerPort}`, data.host);
					done();
				});
			});
		});

		it('should work over an HTTPS proxy', function(done) {
			sslServer.once('request', function(req, res) {
				res.end(JSON.stringify(req.headers));
			});

			let proxy =
				process.env.HTTPS_PROXY ||
				process.env.https_proxy ||
				`https://localhost:${sslProxyPort}`;
			proxy = url.parse(proxy);
			proxy.rejectUnauthorized = false;
			let agent = new HttpsProxyAgent(proxy);

			let opts = url.parse(`https://localhost:${sslServerPort}`);
			opts.agent = agent;
			opts.rejectUnauthorized = false;

			https.get(opts, function(res) {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', function(b) {
					data += b;
				});
				res.on('end', function() {
					data = JSON.parse(data);
					assert.equal(`localhost:${sslServerPort}`, data.host);
					done();
				});
			});
		});

		it('should not send a port number for the default port', function(done) {
			sslServer.once('request', function(req, res) {
				res.end(JSON.stringify(req.headers));
			});

			let proxy =
				process.env.HTTPS_PROXY ||
				process.env.https_proxy ||
				`https://localhost:${sslProxyPort}`;
			proxy = url.parse(proxy);
			proxy.rejectUnauthorized = false;
			let agent = new HttpsProxyAgent(proxy);
			agent.defaultPort = sslServerPort;

			let opts = url.parse(`https://localhost:${sslServerPort}`);
			opts.agent = agent;
			opts.rejectUnauthorized = false;

			https.get(opts, function(res) {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', function(b) {
					data += b;
				});
				res.on('end', function() {
					data = JSON.parse(data);
					assert.equal('localhost', data.host);
					done();
				});
			});
		});
	});
});
