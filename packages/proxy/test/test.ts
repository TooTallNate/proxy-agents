import * as net from 'net';
import * as http from 'http';
import assert from 'assert';
import { listen } from 'async-listen';
import { createProxy, ProxyServer } from '../src/proxy';
import { once } from 'events';

describe('proxy', () => {
	let proxy: ProxyServer;
	let proxyUrl: URL;

	let server: http.Server;
	let serverUrl: URL;

	beforeAll(async () => {
		// setup proxy server
		proxy = createProxy(http.createServer());
		proxyUrl = (await listen(proxy)) as URL;
	});

	beforeAll(async () => {
		// setup target server
		server = http.createServer();
		serverUrl = (await listen(server)) as URL;
	});

	afterAll(() => {
		proxy.close();
		server.close();
	});

	beforeEach(() => {
		server.removeAllListeners('request');
	});

	it('should proxy HTTP GET requests (keep-alive)', async () => {
		let requestCount = 0;

		server.on('request', (req, res) => {
			requestCount++;
			// ensure headers are being proxied
			expect(req.headers['user-agent']).toEqual('curl/7.30.0');
			expect(req.headers.host).toEqual(serverUrl.host);
			expect(req.headers.accept).toEqual('*/*');
			res.end();
		});

		const socket = net.connect({ port: +proxyUrl.port });
		await once(socket, 'connect');
		socket.write(
			'GET http://' +
				serverUrl.host +
				'/ HTTP/1.1\r\n' +
				'User-Agent: curl/7.30.0\r\n' +
				'Host: ' +
				serverUrl.host +
				'\r\n' +
				'Accept: */*\r\n' +
				'Proxy-Connection: Keep-Alive\r\n' +
				'\r\n'
		);

		socket.setEncoding('utf8');
		const [data] = await once(socket, 'data');
		assert(0 == data.indexOf('HTTP/1.1 200 OK\r\n'));
		assert(requestCount);

		socket.write(
			'GET http://' +
				serverUrl.host +
				'/ HTTP/1.1\r\n' +
				'User-Agent: curl/7.30.0\r\n' +
				'Host: ' +
				serverUrl.host +
				'\r\n' +
				'Accept: */*\r\n' +
				'Proxy-Connection: Keep-Alive\r\n' +
				'\r\n'
		);
		const [data2] = await once(socket, 'data');
		assert(0 == data2.indexOf('HTTP/1.1 200 OK\r\n'));

		socket.destroy();
	});

	it('should establish connection for CONNECT requests (keep-alive)', async () => {
		let requestCount = 0;

		server.on('request', (req, res) => {
			requestCount++;
			// ensure headers are being proxied
			expect(req.headers.host).toEqual(serverUrl.host);
			expect(req.headers.foo).toEqual('bar');
			res.end();
		});

		const socket = net.connect({ port: +proxyUrl.port });
		await once(socket, 'connect');

		socket.write(
			'CONNECT ' +
				serverUrl.host +
				' HTTP/1.1\r\n' +
				'Host: ' +
				serverUrl.host +
				'\r\n' +
				'User-Agent: curl/7.30.0\r\n' +
				'Proxy-Connection: Keep-Alive\r\n' +
				'\r\n'
		);

		socket.setEncoding('utf8');
		const [data] = await once(socket, 'data');
		assert(0 == data.indexOf('HTTP/1.1 200 Connection established\r\n'));
		expect(requestCount).toEqual(0);

		socket.write(
			'GET / HTTP/1.1\r\n' +
				'Host: ' +
				serverUrl.host +
				'\r\n' +
				'Connection: Keep-Alive\r\n' +
				'Foo: bar\r\n' +
				'\r\n'
		);

		const [data2] = await once(socket, 'data');
		expect(data2.includes('Connection: keep-alive')).toEqual(true);
		expect(requestCount).toEqual(1);

		socket.write(
			'GET / HTTP/1.1\r\n' +
				'Host: ' +
				serverUrl.host +
				'\r\n' +
				'Connection: Keep-Alive\r\n' +
				'Foo: bar\r\n' +
				'\r\n'
		);

		const [data3] = await once(socket, 'data');
		expect(data3.includes('Connection: keep-alive')).toEqual(true);
		expect(requestCount).toEqual(2);

		socket.destroy();
	});

	describe('authentication', () => {
		beforeAll(() => {
			delete proxy.authenticate;
		});

		it('should invoke the `server.authenticate()` function when set', async () => {
			const auth = 'Basic Zm9vOmJhcg==';

			const authPromise = new Promise<void>((resolve) => {
				proxy.authenticate = (req) => {
					assert(auth === req.headers['proxy-authorization']);
					socket.destroy();
					resolve();
					return true;
				};
			});

			const socket = net.connect({ port: +proxyUrl.port });
			await once(socket, 'connect');
			socket.write(
				'GET / HTTP/1.1\r\n' +
					'Host: foo.com\r\n' +
					'Proxy-Authorization: ' +
					auth +
					'\r\n' +
					'\r\n'
			);

			await authPromise;
		});

		it('should provide the HTTP client with a 407 response status code', async () => {
			// reject everything
			proxy.authenticate = () => false;

			const socket = net.connect({ port: +proxyUrl.port });
			await once(socket, 'connect');

			socket.write('GET / HTTP/1.1\r\nHost: foo.com\r\n\r\n');

			socket.setEncoding('utf8');
			const [data] = await once(socket, 'data');
			assert(0 == data.indexOf('HTTP/1.1 407'));
			socket.destroy();
		});

		it("should close the socket after a CONNECT request's 407 response status code", async () => {
			// reject everything
			proxy.authenticate = () => false;

			const socket = net.connect({ port: +proxyUrl.port });
			await once(socket, 'connect');
			socket.write('CONNECT 127.0.0.1:80 HTTP/1.1\r\n\r\n');
			socket.setEncoding('utf8');
			const [data] = await once(socket, 'data');
			assert(0 == data.indexOf('HTTP/1.1 407'));
		});
	});
});
