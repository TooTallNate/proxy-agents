const assert = require('assert');
const { resolve } = require('path');
const { readFileSync } = require('fs');
const { createPacResolver } = require('../');

describe('FindProxyForURL', function () {
	it('should return `undefined` by default', function (done) {
		var FindProxyForURL = createPacResolver(
			'function FindProxyForURL (url, host) {' + '  /* noop */' + '}'
		);
		FindProxyForURL('http://foo.com/', 'foo.com', function (err, res) {
			if (err) return done(err);
			assert.strictEqual(undefined, res);
			done();
		});
	});

	it('should return the value that gets returned', function (done) {
		var FindProxyForURL = createPacResolver(
			'function FindProxyForURL (url, host) {' +
				'  return { foo: "bar" };' +
				'}'
		);
		FindProxyForURL('http://foo.com/', 'foo.com', function (err, res) {
			if (err) return done(err);
			assert.deepEqual({ foo: 'bar' }, res);
			done();
		});
	});

	it('should not modify the passed-in options object', function (done) {
		function foo() {}
		const opts = { sandbox: { foo } };
		const FindProxyForURL = createPacResolver(
			'function FindProxyForURL (url, host) { return typeof foo; }',
			opts
		);
		assert.deepEqual(opts, { sandbox: { foo } });
		FindProxyForURL('http://foo.com/', function (err, res) {
			if (err) return done(err);
			assert.deepEqual('function', res);
			done();
		});
	});

	it('should prevent untrusted code from escaping the sandbox', function () {
		let err;
		try {
			createPacResolver(
				`// Real PAC config:
				function FindProxyForURL(url, host) {
				return "DIRECT";
				}

				// But also run arbitrary code:
				var f = this.constructor.constructor(\`
				process.exit(1);
				\`);

				f();
				`
			);
		} catch (_err) {
			err = _err;
		}
		assert.strictEqual(err.message, 'process is not defined');
	});

	describe('official docs Example #1', function () {
		var FindProxyForURL = createPacResolver(
			'function FindProxyForURL(url, host) {' +
				'  if (isPlainHostName(host) ||' +
				'      dnsDomainIs(host, ".netscape.com"))' +
				'      return "DIRECT";' +
				'  else' +
				'      return "PROXY w3proxy.netscape.com:8080; DIRECT";' +
				'}'
		);

		it('should return "DIRECT" for "localhost"', function (done) {
			FindProxyForURL(
				'http://localhost/hello',
				'localhost',
				function (err, res) {
					if (err) return done(err);
					assert.equal('DIRECT', res);
					done();
				}
			);
		});

		it('should return "DIRECT" for "foo.netscape.com"', function (done) {
			FindProxyForURL(
				'http://foo.netscape.com/',
				'foo.netscape.com',
				function (err, res) {
					if (err) return done(err);
					assert.equal('DIRECT', res);
					done();
				}
			);
		});

		it('should return "PROXY …" for "google.com"', function (done) {
			FindProxyForURL(
				'http://google.com/t',
				'google.com',
				function (err, res) {
					if (err) return done(err);
					assert.equal(
						'PROXY w3proxy.netscape.com:8080; DIRECT',
						res
					);
					done();
				}
			);
		});
	});

	describe('official docs Example #1b', function () {
		var FindProxyForURL = createPacResolver(
			'function FindProxyForURL(url, host)' +
				'{' +
				'    if ((isPlainHostName(host) ||' +
				'         dnsDomainIs(host, ".netscape.com")) &&' +
				'        !localHostOrDomainIs(host, "www.netscape.com") &&' +
				'        !localHostOrDomainIs(host, "merchant.netscape.com"))' +
				'        return "DIRECT";' +
				'    else' +
				'        return "PROXY w3proxy.netscape.com:8080; DIRECT";' +
				'}'
		);

		it('should return "DIRECT" for "localhost"', function (done) {
			FindProxyForURL(
				'http://localhost/hello',
				'localhost',
				function (err, res) {
					if (err) return done(err);
					assert.equal('DIRECT', res);
					done();
				}
			);
		});

		it('should return "DIRECT" for "foo.netscape.com"', function (done) {
			FindProxyForURL(
				'http://foo.netscape.com/',
				'foo.netscape.com',
				function (err, res) {
					if (err) return done(err);
					assert.equal('DIRECT', res);
					done();
				}
			);
		});

		it('should return "PROXY …" for "www.netscape.com"', function (done) {
			FindProxyForURL(
				'http://www.netscape.com/',
				'www.netscape.com',
				function (err, res) {
					if (err) return done(err);
					assert.equal(
						'PROXY w3proxy.netscape.com:8080; DIRECT',
						res
					);
					done();
				}
			);
		});

		it('should return "PROXY …" for "merchant.netscape.com"', function (done) {
			FindProxyForURL(
				'http://merchant.netscape.com/',
				'merchant.netscape.com',
				function (err, res) {
					if (err) return done(err);
					assert.equal(
						'PROXY w3proxy.netscape.com:8080; DIRECT',
						res
					);
					done();
				}
			);
		});
	});

	describe('official docs Example #5', function () {
		var FindProxyForURL = createPacResolver(
			'function FindProxyForURL(url, host)' +
				'{' +
				'    if (url.substring(0, 5) == "http:") {' +
				'        return "PROXY http-proxy.mydomain.com:8080";' +
				'    }' +
				'    else if (url.substring(0, 4) == "ftp:") {' +
				'        return "PROXY ftp-proxy.mydomain.com:8080";' +
				'    }' +
				'    else if (url.substring(0, 7) == "gopher:") {' +
				'        return "PROXY gopher-proxy.mydomain.com:8080";' +
				'    }' +
				'    else if (url.substring(0, 6) == "https:" ||' +
				'             url.substring(0, 6) == "snews:") {' +
				'        return "PROXY security-proxy.mydomain.com:8080";' +
				'    }' +
				'    else {' +
				'        return "DIRECT";' +
				'    }' +
				'}'
		);

		it('should return "DIRECT" for "foo://netscape.com"', function (done) {
			FindProxyForURL(
				'foo://netscape.com/hello',
				'netscape.com',
				function (err, res) {
					if (err) return done(err);
					assert.equal('DIRECT', res);
					done();
				}
			);
		});

		it('should return "PROXY http…" for "http://netscape.com"', function (done) {
			FindProxyForURL(
				'http://netscape.com/hello',
				'netscape.com',
				function (err, res) {
					if (err) return done(err);
					assert.equal('PROXY http-proxy.mydomain.com:8080', res);
					done();
				}
			);
		});

		it('should return "PROXY ftp…" for "ftp://netscape.com"', function (done) {
			FindProxyForURL(
				'ftp://netscape.com/hello',
				'netscape.com',
				function (err, res) {
					if (err) return done(err);
					assert.equal('PROXY ftp-proxy.mydomain.com:8080', res);
					done();
				}
			);
		});

		it('should return "PROXY gopher…" for "gopher://netscape.com"', function (done) {
			FindProxyForURL(
				'gopher://netscape.com/hello',
				'netscape.com',
				function (err, res) {
					if (err) return done(err);
					assert.equal('PROXY gopher-proxy.mydomain.com:8080', res);
					done();
				}
			);
		});

		it('should return "PROXY security…" for "https://netscape.com"', function (done) {
			FindProxyForURL(
				'https://netscape.com/hello',
				'netscape.com',
				function (err, res) {
					if (err) return done(err);
					assert.equal('PROXY security-proxy.mydomain.com:8080', res);
					done();
				}
			);
		});

		it('should return "PROXY security…" for "snews://netscape.com"', function (done) {
			FindProxyForURL(
				'snews://netscape.com/hello',
				'netscape.com',
				function (err, res) {
					if (err) return done(err);
					assert.equal('PROXY security-proxy.mydomain.com:8080', res);
					done();
				}
			);
		});
	});

	describe('GitHub issue #3', function () {
		var FindProxyForURL = createPacResolver(
			'function FindProxyForURL(url, host) {\n' +
				'    if (isHostInAnySubnet(host, ["10.1.2.0", "10.1.3.0"], "255.255.255.0")) {\n' +
				'        return "HTTPS proxy.example.com";\n' +
				'    }\n' +
				'\n' +
				'    if (isHostInAnySubnet(host, ["10.2.2.0", "10.2.3.0"], "255.255.255.0")) {\n' +
				'        return "HTTPS proxy.example.com";\n' +
				'    }\n' +
				'\n' +
				'    // Everything else, go direct:\n' +
				'    return "DIRECT";\n' +
				'}\n' +
				'\n' +
				'// Checks if the single host is within a list of subnets using the single mask.\n' +
				'function isHostInAnySubnet(host, subnets, mask) {\n' +
				'    var subnets_length = subnets.length;\n' +
				'    for (i = 0; i < subnets_length; i++) {\n' +
				'        if (isInNet(host, subnets[i], mask)) {\n' +
				'            return true;\n' +
				'        }\n' +
				'    }\n' +
				'}\n'
		);

		it('should return "HTTPS proxy.example.com" for "http://10.1.2.3/bar.html"', function (done) {
			FindProxyForURL(
				'http://10.1.2.3/bar.html',
				'10.1.2.3',
				function (err, res) {
					if (err) return done(err);
					assert.equal('HTTPS proxy.example.com', res);
					done();
				}
			);
		});

		it('should return "DIRECT" for "http://foo.com/bar.html"', function (done) {
			FindProxyForURL(
				'http://foo.com/bar.html',
				'foo.com',
				function (err, res) {
					if (err) return done(err);
					assert.equal('DIRECT', res);
					done();
				}
			);
		});
	});

	// https://github.com/breakwa11/gfw_whitelist
	// https://github.com/TooTallNate/node-pac-resolver/issues/20
	describe('GitHub issue #20', function () {
		const FindProxyForURL = createPacResolver(
			readFileSync(resolve(__dirname, 'fixtures/gfw_whitelist.pac'))
		);

		it('should return "DIRECT" for "https://example.cn"', function (done) {
			FindProxyForURL('https://example.cn/').then((res) => {
				assert.equal('DIRECT;', res);
				done();
			}, done);
		});

		it('should return "SOCKS5 127.0.0.1:1080;" for "https://example.com"', function (done) {
			FindProxyForURL('https://example.com/').then((res) => {
				assert.equal('SOCKS5 127.0.0.1:1080;', res);
				done();
			}, done);
		});
	});

	describe('`filename` option', function () {
		const code = String(function FindProxyForURL() {
			throw new Error('fail');
		});

		it('should include `proxy.pac` in stack traces by default', function (done) {
			const FindProxyForURL = createPacResolver(code);
			FindProxyForURL('https://example.com/').catch((err) => {
				assert(err);
				assert.equal(err.message, 'fail');
				assert(
					err.stack.indexOf('at FindProxyForURL (proxy.pac:') !== -1
				);
				done();
			});
		});

		it('should include `fail.pac` in stack traces by option', function (done) {
			const FindProxyForURL = createPacResolver(code, {
				filename: 'fail.pac',
			});
			FindProxyForURL('https://example.com/').catch((err) => {
				assert(err);
				assert.equal(err.message, 'fail');
				assert(
					err.stack.indexOf('at FindProxyForURL (fail.pac:') !== -1
				);
				done();
			});
		});
	});
});
