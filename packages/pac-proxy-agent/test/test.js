/**
 * Module dependencies.
 */

let fs = require('fs');
let url = require('url');
let http = require('http');
let https = require('https');
let assert = require('assert');
let getRawBody = require('raw-body');
let Proxy = require('proxy');
let socks = require('socksv5');
let PacProxyAgent = require('../');

describe('PacProxyAgent', function() {
	// target servers
	let httpServer;
	let httpPort;
	let httpsServer;
	let httpsPort;

	// proxy servers
	let socksServer;
	let socksPort;
	let proxyServer;
	let proxyPort;
	let proxyHttpsServer;
	let proxyHttpsPort;

	before(function(done) {
		// setup target HTTP server
		httpServer = http.createServer();
		httpServer.listen(function() {
			httpPort = httpServer.address().port;
			done();
		});
	});

	before(function(done) {
		// setup target SSL HTTPS server
		let options = {
			key: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.key`),
			cert: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.pem`)
		};
		httpsServer = https.createServer(options);
		httpsServer.listen(function() {
			httpsPort = httpsServer.address().port;
			done();
		});
	});

	before(function(done) {
		// setup SOCKS proxy server
		socksServer = socks.createServer(function(info, accept, deny) {
			accept();
		});
		socksServer.listen(function() {
			socksPort = socksServer.address().port;
			done();
		});
		socksServer.useAuth(socks.auth.None());
	});

	before(function(done) {
		// setup HTTP proxy server
		proxyServer = Proxy();
		proxyServer.listen(function() {
			proxyPort = proxyServer.address().port;
			done();
		});
	});

	before(function(done) {
		// setup SSL HTTPS proxy server
		let options = {
			key: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.key`),
			cert: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.pem`)
		};
		proxyHttpsServer = Proxy(https.createServer(options));
		proxyHttpsServer.listen(function() {
			proxyHttpsPort = proxyHttpsServer.address().port;
			done();
		});
	});

	after(function(done) {
		// socksServer.once('close', function () { done(); });
		socksServer.close();
		done();
	});

	after(function(done) {
		// httpServer.once('close', function () { done(); });
		httpServer.close();
		done();
	});

	after(function(done) {
		// httpsServer.once('close', function () { done(); });
		httpsServer.close();
		done();
	});

	after(function(done) {
		// proxyServer.once('close', function () { done(); });
		proxyServer.close();
		done();
	});

	after(function(done) {
		// proxyHttpsServer.once('close', function () { done(); });
		proxyHttpsServer.close();
		done();
	});

	it('should allow a `sandbox` to be passed in', function(done) {
		this.slow(1000);

		function FindProxyForURL(url, host) {
			throw new Error(foo() + bar());
		}

		function foo() {
			return 'hi';
		}

		function asyncBar() {
			return new Promise(r => r('fooooo'));
		}
		asyncBar.async = true;

		let uri = `data:,${encodeURIComponent(FindProxyForURL.toString())}`;
		let agent = new PacProxyAgent(uri, {
			sandbox: {
				foo,
				bar: asyncBar
			}
		});

		let opts = url.parse(`http://localhost:${httpPort}/test`);
		opts.agent = agent;

		let req = http.get(opts);
		req.once('error', function(err) {
			assert.equal(err.message, 'hifooooo');
			done();
		});
	});

	describe('constructor', function() {
		it('should throw an Error if no "proxy" argument is given', function() {
			assert.throws(function() {
				new PacProxyAgent();
			});
		});
		it('should accept a "string" proxy argument', function() {
			let agent = new PacProxyAgent('pac+ftp://example.com/proxy.pac');
			assert.equal('ftp://example.com/proxy.pac', agent.uri);
		});
		it('should accept a `url.parse()` result object argument', function() {
			let opts = url.parse('pac+ftp://example.com/proxy.pac');
			let agent = new PacProxyAgent(opts);
			assert.equal('ftp://example.com/proxy.pac', agent.uri);
		});
		it('should accept a `uri` on the options object', function() {
			let agent = new PacProxyAgent({
				uri: 'pac+ftp://example.com/proxy.pac'
			});
			assert.equal('ftp://example.com/proxy.pac', agent.uri);
		});
	});

	describe('"http" module', function() {
		it('should work over an HTTP proxy', function(done) {
			httpServer.once('request', function(req, res) {
				res.end(JSON.stringify(req.headers));
			});

			function FindProxyForURL(url, host) {
				return 'PROXY localhost:PORT;';
			}

			let uri = `data:,${encodeURIComponent(
				FindProxyForURL.toString().replace('PORT', proxyPort)
			)}`;
			let agent = new PacProxyAgent(uri);

			let opts = url.parse(`http://localhost:${httpPort}/test`);
			opts.agent = agent;

			let req = http.get(opts, function(res) {
				getRawBody(res, 'utf8', function(err, buf) {
					if (err) return done(err);
					let data = JSON.parse(buf);
					assert.equal(`localhost:${httpPort}`, data.host);
					assert('via' in data);
					done();
				});
			});
			req.once('error', done);
		});

		it('should work over an HTTPS proxy', function(done) {
			httpServer.once('request', function(req, res) {
				res.end(JSON.stringify(req.headers));
			});

			function FindProxyForURL(url, host) {
				return 'HTTPS localhost:PORT;';
			}

			let uri = `data:,${encodeURIComponent(
				FindProxyForURL.toString().replace('PORT', proxyHttpsPort)
			)}`;
			let proxy = url.parse(uri);
			proxy.rejectUnauthorized = false;
			let agent = new PacProxyAgent(proxy);

			let opts = url.parse(`http://localhost:${httpPort}/test`);
			opts.agent = agent;

			let req = http.get(opts, function(res) {
				getRawBody(res, 'utf8', function(err, buf) {
					if (err) return done(err);
					let data = JSON.parse(buf);
					assert.equal(`localhost:${httpPort}`, data.host);
					assert('via' in data);
					done();
				});
			});
			req.once('error', done);
		});

		it('should work over a SOCKS proxy', function(done) {
			httpServer.once('request', function(req, res) {
				res.end(JSON.stringify(req.headers));
			});

			function FindProxyForURL(url, host) {
				return 'SOCKS localhost:PORT;';
			}

			let uri = `data:,${encodeURIComponent(
				FindProxyForURL.toString().replace('PORT', socksPort)
			)}`;
			let agent = new PacProxyAgent(uri);

			let opts = url.parse(`http://localhost:${httpPort}/test`);
			opts.agent = agent;

			let req = http.get(opts, function(res) {
				getRawBody(res, 'utf8', function(err, buf) {
					if (err) return done(err);
					let data = JSON.parse(buf);
					assert.equal(`localhost:${httpPort}`, data.host);
					done();
				});
			});
			req.once('error', done);
		});

		it('should fall back to the next proxy after one fails', function(done) {
			// This test is slow on Windows :/
			this.timeout(10000);

			let gotReq = false;
			httpServer.once('request', function(req, res) {
				res.end(JSON.stringify(req.headers));
				gotReq = true;
			});

			function FindProxyForURL(url, host) {
				return 'SOCKS bad-domain:8080; HTTP bad-domain:8080; HTTPS bad-domain:8080; DIRECT;';
			}

			let uri = `data:,${encodeURIComponent(String(FindProxyForURL))}`;
			let agent = new PacProxyAgent(uri);

			let opts = url.parse(`http://localhost:${httpPort}/test`);
			opts.agent = agent;

			let req = http.get(opts, function(res) {
				getRawBody(res, 'utf8', function(err, buf) {
					if (err) return done(err);
					let data = JSON.parse(buf);
					assert.equal(`localhost:${httpPort}`, data.host);
					assert.equal(proxyCount, 4);
					assert(gotReq);
					done();
				});
			});

			let proxyCount = 0;
			req.on('proxy', function({ proxy, error, socket }) {
				proxyCount++;
				if (proxy === 'DIRECT') {
					assert(socket);
				} else {
					assert(error);
				}
			});

			req.once('error', done);
		});

		it('should support `fallbackToDirect` option', function(done) {
			// This test is slow on Windows :/
			this.timeout(10000);

			let gotReq = false;
			httpServer.once('request', function(req, res) {
				res.end(JSON.stringify(req.headers));
				gotReq = true;
			});

			function FindProxyForURL(url, host) {
				return 'SOCKS 127.0.0.1:4';
			}

			const uri = `data:,${encodeURIComponent(String(FindProxyForURL))}`;
			const agent = new PacProxyAgent(uri, { fallbackToDirect: true });

			const opts = url.parse(`http://localhost:${httpPort}/test`);
			opts.agent = agent;

			const req = http.get(opts, function(res) {
				getRawBody(res, 'utf8', function(err, buf) {
					if (err) return done(err);
					const data = JSON.parse(buf);
					assert.equal(`localhost:${httpPort}`, data.host);
					assert(gotReq);
					done();
				});
			});
			req.once('error', done);
		});
	});

	describe('"https" module', function() {
		it('should work over an HTTP proxy', function(done) {
			httpsServer.once('request', function(req, res) {
				res.end(JSON.stringify(req.headers));
			});

			function FindProxyForURL(url, host) {
				return 'PROXY localhost:PORT;';
			}

			let uri = `data:,${encodeURIComponent(
				FindProxyForURL.toString().replace('PORT', proxyPort)
			)}`;
			let agent = new PacProxyAgent(uri);

			let opts = url.parse(`https://localhost:${httpsPort}/test`);
			opts.agent = agent;
			opts.rejectUnauthorized = false;

			let req = https.get(opts, function(res) {
				getRawBody(res, 'utf8', function(err, buf) {
					if (err) return done(err);
					let data = JSON.parse(buf);
					assert.equal(`localhost:${httpsPort}`, data.host);
					done();
				});
			});
			req.once('error', done);
		});

		it('should work over an HTTPS proxy', function(done) {
			let gotReq = false;
			httpsServer.once('request', function(req, res) {
				gotReq = true;
				res.end(JSON.stringify(req.headers));
			});

			function FindProxyForURL(url, host) {
				return 'HTTPS localhost:PORT;';
			}

			let uri = `data:,${encodeURIComponent(
				FindProxyForURL.toString().replace('PORT', proxyHttpsPort)
			)}`;
			let agent = new PacProxyAgent(uri, {
				rejectUnauthorized: false
			});

			let opts = url.parse(`https://localhost:${httpsPort}/test`);
			opts.agent = agent;
			opts.rejectUnauthorized = false;

			let req = https.get(opts, function(res) {
				getRawBody(res, 'utf8', function(err, buf) {
					if (err) return done(err);
					let data = JSON.parse(buf);
					assert.equal(`localhost:${httpsPort}`, data.host);
					assert(gotReq);
					done();
				});
			});
			req.once('error', done);
		});

		it('should work over a SOCKS proxy', function(done) {
			let gotReq = false;
			httpsServer.once('request', function(req, res) {
				gotReq = true;
				res.end(JSON.stringify(req.headers));
			});

			function FindProxyForURL(url, host) {
				return 'SOCKS localhost:PORT;';
			}

			let uri = `data:,${encodeURIComponent(
				FindProxyForURL.toString().replace('PORT', socksPort)
			)}`;
			let agent = new PacProxyAgent(uri);

			let opts = url.parse(`https://localhost:${httpsPort}/test`);
			opts.agent = agent;
			opts.rejectUnauthorized = false;

			let req = https.get(opts, function(res) {
				getRawBody(res, 'utf8', function(err, buf) {
					if (err) return done(err);
					let data = JSON.parse(buf);
					assert.equal(`localhost:${httpsPort}`, data.host);
					assert(gotReq);
					done();
				});
			});
			req.once('error', done);
		});

		it('should fall back to the next proxy after one fails', function(done) {
			// This test is slow on Windows :/
			this.timeout(10000);

			let gotReq = false;
			httpsServer.once('request', function(req, res) {
				gotReq = true;
				res.end(JSON.stringify(req.headers));
			});

			function FindProxyForURL(url, host) {
				return 'SOCKS bad-domain:8080; HTTP bad-domain:8080; HTTPS bad-domain:8080; DIRECT;';
			}

			let uri = `data:,${encodeURIComponent(String(FindProxyForURL))}`;
			let agent = new PacProxyAgent(uri);

			let opts = url.parse(`https://localhost:${httpsPort}/test`);
			opts.agent = agent;
			opts.rejectUnauthorized = false;

			let req = https.get(opts, function(res) {
				getRawBody(res, 'utf8', function(err, buf) {
					if (err) return done(err);
					let data = JSON.parse(buf);
					assert.equal(`localhost:${httpsPort}`, data.host);
					assert.equal(proxyCount, 4);
					assert(gotReq);
					done();
				});
			});

			let proxyCount = 0;
			req.on('proxy', function({ proxy, error, socket }) {
				proxyCount++;
				if (proxy === 'DIRECT') {
					assert(socket);
				} else {
					assert(error);
				}
			});

			req.once('error', done);
		});
	});
});
