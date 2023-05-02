import assert from 'assert';
import * as fs from 'fs';
import * as net from 'net';
import * as tls from 'tls';
import * as http from 'http';
import * as https from 'https';
import { once } from 'events';
import { listen } from 'async-listen';
import { Agent, AgentConnectOpts, req, json } from '../src';

const sleep = (n: number) => new Promise((r) => setTimeout(r, n));

const sslOptions = {
	key: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.key`),
	cert: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.pem`),
};

describe('Agent (TypeScript)', () => {
	describe('subclass', () => {
		it('should be extendable (direct return)', () => {
			class MyAgent extends Agent {
				connect() {
					return http.globalAgent;
				}
			}
			const agent = new MyAgent();
			assert(agent instanceof Agent);
			assert(agent instanceof MyAgent);
		});

		it('should be extendable (async return)', () => {
			class MyAgent extends Agent {
				async connect() {
					return http.globalAgent;
				}
			}
			const agent = new MyAgent();
			assert(agent instanceof Agent);
			assert(agent instanceof MyAgent);
		});
	});

	describe('"http" module', () => {
		it('should work for basic HTTP requests', async () => {
			let gotReq = false;
			let gotCallback = false;

			class MyAgent extends Agent {
				async connect(
					_req: http.ClientRequest,
					opts: AgentConnectOpts
				) {
					gotCallback = true;
					assert(opts.secureEndpoint === false);
					return net.connect(opts);
				}
			}
			const agent = new MyAgent();

			const server = http.createServer((req, res) => {
				gotReq = true;
				res.setHeader('X-Foo', 'bar');
				res.setHeader('X-Url', req.url || '/');
				res.end();
			});
			await listen(server);

			const addr = server.address();
			if (!addr || typeof addr === 'string') {
				throw new Error('Server did not bind to a port');
			}
			const { port } = addr;

			try {
				const res = await req(`http://127.0.0.1:${port}/foo`, {
					agent,
				});
				assert.equal('bar', res.headers['x-foo']);
				assert.equal('/foo', res.headers['x-url']);
				assert(gotReq);
				assert(gotCallback);
			} finally {
				server.close();
			}
		});

		it('should not send a port number for the default port', async () => {
			class MyAgent extends Agent {
				connect(
					_req: http.ClientRequest,
					opts: AgentConnectOpts
				): net.Socket {
					assert(opts.secureEndpoint === false);
					assert.equal(this.defaultPort, port);
					assert.equal(opts.port, port);
					return net.connect(opts);
				}
			}

			const agent = new MyAgent();
			const server = http.createServer((req, res) => {
				res.end(JSON.stringify(req.headers));
			});
			await listen(server);

			const addr = server.address();
			if (!addr || typeof addr === 'string') {
				throw new Error('Server did not bind to a port');
			}
			const { port } = addr;

			agent.defaultPort = port;

			try {
				const res = await req(`http://127.0.0.1:${port}/foo`, {
					agent,
				});
				const body = await json(res);
				assert.equal(body.host, '127.0.0.1');
			} finally {
				server.close();
			}
		});

		it('should work after the first tick of the `http.ClientRequest` instance', async () => {
			let gotReq = false;
			let gotCallback = false;

			class MyAgent extends Agent {
				async connect(
					_req: http.ClientRequest,
					opts: AgentConnectOpts
				): Promise<net.Socket> {
					gotCallback = true;
					assert(opts.secureEndpoint === false);
					await sleep(10);
					return net.connect(opts);
				}
			}

			const agent = new MyAgent();

			const server = http.createServer((req, res) => {
				gotReq = true;
				res.setHeader('X-Foo', 'bar');
				res.setHeader('X-Url', req.url || '/');
				res.end();
			});
			await listen(server);

			const addr = server.address();
			if (!addr || typeof addr === 'string') {
				throw new Error('Server did not bind to a port');
			}
			const { port } = addr;

			try {
				const res = await req(`http://127.0.0.1:${port}/foo`, {
					agent,
				});
				assert.equal('bar', res.headers['x-foo']);
				assert.equal('/foo', res.headers['x-url']);
				assert(gotReq);
				assert(gotCallback);
			} finally {
				server.close();
			}
		});

		it('should emit an "error" event on `http.ClientRequest` instance when callback throws sync', async () => {
			let gotError = false;
			let gotCallback = false;

			class MyAgent extends Agent {
				connect(): net.Socket {
					gotCallback = true;
					throw new Error('bad');
				}
			}

			const agent = new MyAgent();

			try {
				await req('http://127.0.0.1/throws', { agent });
			} catch (err: unknown) {
				gotError = true;
				assert.equal((err as Error).message, 'bad');
			}

			assert(gotError);
			assert(gotCallback);
		});

		it('should emit an "error" event on `http.ClientRequest` instance when callback throws async', async () => {
			let gotError = false;
			let gotCallback = false;

			class MyAgent extends Agent {
				async connect(): Promise<net.Socket> {
					gotCallback = true;
					await sleep(10);
					throw new Error('bad');
				}
			}

			const agent = new MyAgent();

			try {
				await req('http://127.0.0.1/throws', { agent });
			} catch (err: unknown) {
				gotError = true;
				assert.equal((err as Error).message, 'bad');
			}

			assert(gotError);
			assert(gotCallback);
		});

		it('should support `keepAlive: true`', async () => {
			let reqCount1 = 0;
			let reqCount2 = 0;
			let connectCount = 0;

			class MyAgent extends Agent {
				async connect(
					_req: http.ClientRequest,
					opts: AgentConnectOpts
				) {
					connectCount++;
					assert(opts.secureEndpoint === false);
					return net.connect(opts);
				}
			}
			const agent = new MyAgent({ keepAlive: true });

			const server1 = http.createServer((req, res) => {
				expect(req.headers.connection).toEqual('keep-alive');
				reqCount1++;
				res.end();
			});
			const addr1 = (await listen(server1)) as URL;

			const server2 = http.createServer((req, res) => {
				expect(req.headers.connection).toEqual('keep-alive');
				reqCount2++;
				res.end();
			});
			const addr2 = (await listen(server2)) as URL;

			try {
				const res = await req(new URL('/foo', addr1), { agent });
				expect(reqCount1).toEqual(1);
				expect(connectCount).toEqual(1);
				expect(res.headers.connection).toEqual('keep-alive');
				res.resume();
				const s1 = res.socket;

				await once(s1, 'free');

				const res2 = await req(new URL('/another', addr1), { agent });
				expect(reqCount1).toEqual(2);
				expect(connectCount).toEqual(1);
				expect(res2.headers.connection).toEqual('keep-alive');
				assert(res2.socket === s1);

				res2.resume();
				await once(res2.socket, 'free');

				// This is a different host, so a new socket should be used
				const res3 = await req(new URL('/another', addr2), { agent });
				expect(reqCount2).toEqual(1);
				expect(connectCount).toEqual(2);
				expect(res3.headers.connection).toEqual('keep-alive');
				assert(res3.socket !== s1);

				res3.resume();
				await once(res3.socket, 'free');
			} finally {
				agent.destroy();
				server1.close();
				server2.close();
			}
		});
	});

	describe('"https" module', () => {
		it('should work for basic HTTPS requests', async () => {
			let gotReq = false;
			let gotCallback = false;

			class MyAgent extends Agent {
				connect(
					_req: http.ClientRequest,
					opts: AgentConnectOpts
				): net.Socket {
					gotCallback = true;
					assert(opts.secureEndpoint === true);
					return tls.connect(opts);
				}
			}

			const agent = new MyAgent();

			const server = https.createServer(sslOptions, (req, res) => {
				gotReq = true;
				res.setHeader('X-Foo', 'bar');
				res.setHeader('X-Url', req.url || '/');
				res.end();
			});
			await listen(server);

			const addr = server.address();
			if (!addr || typeof addr === 'string') {
				throw new Error('Server did not bind to a port');
			}
			const { port } = addr;

			try {
				const res = await req(`https://127.0.0.1:${port}/foo`, {
					agent,
					rejectUnauthorized: false,
				});
				assert.equal('bar', res.headers['x-foo']);
				assert.equal('/foo', res.headers['x-url']);
				assert(gotReq);
				assert(gotCallback);
			} finally {
				server.close();
			}
		});

		it('should work when returning another `agent-base`', async () => {
			let gotReq = false;
			let gotCallback1 = false;
			let gotCallback2 = false;

			class MyAgent1 extends Agent {
				async connect(
					_req: http.ClientRequest,
					opts: AgentConnectOpts
				): Promise<http.Agent> {
					gotCallback1 = true;
					assert.equal(opts.secureEndpoint, true);
					return agent2;
				}
			}

			class MyAgent2 extends Agent {
				async connect(
					_req: http.ClientRequest,
					opts: AgentConnectOpts
				): Promise<net.Socket> {
					gotCallback2 = true;
					assert.equal(opts.secureEndpoint, true);
					return tls.connect(opts);
				}
			}

			const agent1 = new MyAgent1();
			const agent2 = new MyAgent2();

			const server = https.createServer(sslOptions, (req, res) => {
				gotReq = true;
				res.setHeader('X-Foo', 'bar');
				res.setHeader('X-Url', req.url || '/');
				res.end();
			});
			await listen(server);

			const addr = server.address();
			if (!addr || typeof addr === 'string') {
				throw new Error('Server did not bind to a port');
			}
			const { port } = addr;

			try {
				const res = await req(`https://127.0.0.1:${port}/foo`, {
					agent: agent1,
					rejectUnauthorized: false,
				});
				assert.equal('bar', res.headers['x-foo']);
				assert.equal('/foo', res.headers['x-url']);
				assert(gotReq);
				assert(gotCallback1);
				assert(gotCallback2);
			} finally {
				server.close();
			}
		});

		it('should not send a port number for the default port', async () => {
			let reqCount = 0;

			class MyAgent extends Agent {
				connect(
					_req: http.ClientRequest,
					opts: AgentConnectOpts
				): net.Socket {
					assert(opts.secureEndpoint === true);
					assert.equal(agent.defaultPort, port);
					assert.equal(opts.port, port);
					return tls.connect(opts);
				}
			}

			const agent = new MyAgent();

			const server = https.createServer(sslOptions, (req, res) => {
				reqCount++;
				res.end(JSON.stringify(req.headers));
			});
			await listen(server);

			const addr = server.address();
			if (!addr || typeof addr === 'string') {
				throw new Error('Server did not bind to a port');
			}
			const { port } = addr;

			agent.defaultPort = port;

			try {
				const res = await req(`https://127.0.0.1:${port}/foo`, {
					agent,
					rejectUnauthorized: false,
				});
				const body = await json(res);
				assert.equal(body.host, '127.0.0.1');
				assert.equal(reqCount, 1);
			} finally {
				server.close();
			}
		});

		it('should support `keepAlive: true`', async () => {
			let gotReq = false;
			let connectCount = 0;

			class MyAgent extends Agent {
				async connect(
					_req: http.ClientRequest,
					opts: AgentConnectOpts
				) {
					connectCount++;
					assert(opts.secureEndpoint === true);
					return tls.connect(opts);
				}
			}
			const agent = new MyAgent({ keepAlive: true });

			const server = https.createServer(sslOptions, (req, res) => {
				gotReq = true;
				res.end();
			});
			const addr = (await listen(server)) as URL;

			try {
				const res = await req(new URL('/foo', addr), {
					agent,
					rejectUnauthorized: false,
				});
				assert(gotReq);
				expect(connectCount).toEqual(1);
				expect(res.headers.connection).toEqual('keep-alive');
				res.resume();
				const s1 = res.socket;

				await once(s1, 'free');

				const res2 = await req(new URL('/another', addr), {
					agent,
					rejectUnauthorized: false,
				});
				expect(connectCount).toEqual(1);
				expect(res2.headers.connection).toEqual('keep-alive');
				assert(res2.socket === s1);

				res2.resume();
				await once(res2.socket, 'free');
			} finally {
				agent.destroy();
				server.close();
			}
		});
	});
});
