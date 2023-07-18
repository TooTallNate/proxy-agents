import assert from 'assert';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { createPacResolver } from '../src';
import { getQuickJS, type QuickJSWASMModule } from '@tootallnate/quickjs-emscripten';

type FindProxyForURLFn = ReturnType<typeof createPacResolver>;

describe('FindProxyForURL', () => {
	let qjs: QuickJSWASMModule;

	beforeAll(async () => {
		qjs = await getQuickJS();
	});

	it('should return `undefined` by default', async () => {
		const FindProxyForURL = createPacResolver(
			qjs,
			'function FindProxyForURL (url, host) {' + '  /* noop */' + '}'
		);
		const res = await FindProxyForURL('http://foo.com/', 'foo.com');
		expect(res).toBeUndefined();
	});

	it('should return the value that gets returned', async () => {
		const FindProxyForURL = createPacResolver(
			qjs,
			'function FindProxyForURL (url, host) {' +
				'  return { foo: "bar" };' +
				'}'
		);
		const res = await FindProxyForURL('http://foo.com/', 'foo.com');
		expect(res).toEqual({ foo: 'bar' });
	});

	it('should not modify the passed-in options object', async () => {
		function foo() {
			// empty
		}
		const opts = { sandbox: { foo } };
		const FindProxyForURL = createPacResolver(
			qjs,
			'function FindProxyForURL (url, host) { return typeof foo; }',
			opts
		);
		assert.deepEqual(opts, { sandbox: { foo } });
		const res = await FindProxyForURL('http://foo.com/');
		expect(res).toEqual('function');
	});

	it('should prevent untrusted code from escaping the sandbox', () => {
		let err: Error | undefined;
		try {
			createPacResolver(
				qjs,
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
			err = _err as Error;
		}
		assert(err);
		expect(err.message).toEqual("'process' is not defined");
	});

	describe('official docs Example #1', () => {
		let FindProxyForURL: FindProxyForURLFn;

		beforeAll(() => {
			FindProxyForURL = createPacResolver(
				qjs,
				'function FindProxyForURL(url, host) {' +
					'  if (isPlainHostName(host) ||' +
					'      dnsDomainIs(host, ".netscape.com"))' +
					'      return "DIRECT";' +
					'  else' +
					'      return "PROXY w3proxy.netscape.com:8080; DIRECT";' +
					'}'
			);
		});

		it('should return "DIRECT" for "localhost"', async () => {
			const res = await FindProxyForURL(
				'http://localhost/hello',
				'localhost'
			);
			expect(res).toEqual('DIRECT');
		});

		it('should return "DIRECT" for "foo.netscape.com"', async () => {
			const res = await FindProxyForURL(
				'http://foo.netscape.com/',
				'foo.netscape.com'
			);
			expect(res).toEqual('DIRECT');
		});

		it('should return "PROXY …" for "google.com"', async () => {
			const res = await FindProxyForURL(
				'http://google.com/t',
				'google.com'
			);
			expect(res).toEqual('PROXY w3proxy.netscape.com:8080; DIRECT');
		});
	});

	describe('official docs Example #1b', () => {
		let FindProxyForURL: FindProxyForURLFn;

		beforeAll(() => {
			FindProxyForURL = createPacResolver(
				qjs,
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
		});

		it('should return "DIRECT" for "localhost"', async () => {
			const res = await FindProxyForURL(
				'http://localhost/hello',
				'localhost'
			);
			expect(res).toEqual('DIRECT');
		});

		it('should return "DIRECT" for "foo.netscape.com"', async () => {
			const res = await FindProxyForURL(
				'http://foo.netscape.com/',
				'foo.netscape.com'
			);
			expect(res).toEqual('DIRECT');
		});

		it('should return "PROXY …" for "www.netscape.com"', async () => {
			const res = await FindProxyForURL(
				'http://www.netscape.com/',
				'www.netscape.com'
			);
			expect(res).toEqual('PROXY w3proxy.netscape.com:8080; DIRECT');
		});

		it('should return "PROXY …" for "merchant.netscape.com"', async () => {
			const res = await FindProxyForURL(
				'http://merchant.netscape.com/',
				'merchant.netscape.com'
			);
			expect(res).toEqual('PROXY w3proxy.netscape.com:8080; DIRECT');
		});
	});

	describe('official docs Example #5', () => {
		let FindProxyForURL: FindProxyForURLFn;

		beforeAll(() => {
			FindProxyForURL = createPacResolver(
				qjs,
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
		});

		it('should return "DIRECT" for "foo://netscape.com"', async () => {
			const res = await FindProxyForURL(
				'foo://netscape.com/hello',
				'netscape.com'
			);
			expect(res).toEqual('DIRECT');
		});

		it('should return "PROXY http…" for "http://netscape.com"', async () => {
			const res = await FindProxyForURL(
				'http://netscape.com/hello',
				'netscape.com'
			);
			expect(res).toEqual('PROXY http-proxy.mydomain.com:8080');
		});

		it('should return "PROXY ftp…" for "ftp://netscape.com"', async () => {
			const res = await FindProxyForURL(
				'ftp://netscape.com/hello',
				'netscape.com'
			);
			expect(res).toEqual('PROXY ftp-proxy.mydomain.com:8080');
		});

		it('should return "PROXY gopher…" for "gopher://netscape.com"', async () => {
			const res = await FindProxyForURL(
				'gopher://netscape.com/hello',
				'netscape.com'
			);
			expect(res).toEqual('PROXY gopher-proxy.mydomain.com:8080');
		});

		it('should return "PROXY security…" for "https://netscape.com"', async () => {
			const res = await FindProxyForURL(
				'https://netscape.com/hello',
				'netscape.com'
			);
			expect(res).toEqual('PROXY security-proxy.mydomain.com:8080');
		});

		it('should return "PROXY security…" for "snews://netscape.com"', async () => {
			const res = await FindProxyForURL(
				'snews://netscape.com/hello',
				'netscape.com'
			);
			expect(res).toEqual('PROXY security-proxy.mydomain.com:8080');
		});
	});

	describe('GitHub issue #3', () => {
		let FindProxyForURL: FindProxyForURLFn;

		beforeAll(() => {
			FindProxyForURL = createPacResolver(
				qjs,
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
		});

		it('should return "HTTPS proxy.example.com" for "http://10.1.2.3/bar.html"', async () => {
			const res = await FindProxyForURL(
				'http://10.1.2.3/bar.html',
				'10.1.2.3'
			);
			expect(res).toEqual('HTTPS proxy.example.com');
		});

		it('should return "DIRECT" for "http://foo.com/bar.html"', async () => {
			const res = await FindProxyForURL(
				'http://foo.com/bar.html',
				'foo.com'
			);
			expect(res).toEqual('DIRECT');
		});
	});

	// https://github.com/breakwa11/gfw_whitelist
	// https://github.com/TooTallNate/node-pac-resolver/issues/20
	describe('GitHub issue #20', () => {
		let FindProxyForURL: FindProxyForURLFn;

		beforeAll(() => {
			FindProxyForURL = createPacResolver(
				qjs,
				readFileSync(resolve(__dirname, 'fixtures/gfw_whitelist.pac'))
			);
		});

		it('should return "DIRECT" for "https://example.cn"', async () => {
			const res = await FindProxyForURL('https://example.cn/');
			expect(res).toEqual('DIRECT;');
		});

		it('should return "SOCKS5 127.0.0.1:1080;" for "https://example.com"', async () => {
			const res = await FindProxyForURL('https://example.com/');
			expect(res).toEqual('SOCKS5 127.0.0.1:1080;');
		});
	});

	describe('`filename` option', () => {
		const code = String(function FindProxyForURL() {
			throw new Error('fail');
		});

		it('should include `proxy.pac` in stack traces by default', async () => {
			let err: Error | undefined;
			const FindProxyForURL = createPacResolver(qjs, code);
			try {
				await FindProxyForURL('https://example.com/');
			} catch (_err) {
				err = _err as Error;
			}
			assert(err);
			expect(err.message).toEqual('fail');
			expect(
				err.stack?.indexOf('at FindProxyForURL (proxy.pac:')
			).not.toEqual(-1);
		});

		it('should include `fail.pac` in stack traces by option', async () => {
			let err: Error | undefined;
			const FindProxyForURL = createPacResolver(qjs, code, {
				filename: 'fail.pac',
			});
			try {
				await FindProxyForURL('https://example.com/');
			} catch (_err) {
				err = _err as Error;
			}
			assert(err);
			expect(err.message).toEqual('fail');
			expect(
				err.stack?.indexOf('at FindProxyForURL (fail.pac:')
			).not.toEqual(-1);
		});
	});
});
