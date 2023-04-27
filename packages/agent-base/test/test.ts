import * as fs from 'fs';
import * as net from 'net';
import * as tls from 'tls';
import * as url from 'url';
import * as http from 'http';
import * as https from 'https';
import assert from 'assert';
import listen from 'async-listen';
import { Agent, AgentConnectOpts } from '../src';

const sleep = (n: number) => new Promise((r) => setTimeout(r, n));

const req = (opts: https.RequestOptions): Promise<http.IncomingMessage> =>
	new Promise((resolve, reject) => {
		(opts.protocol === 'https:' ? https : http)
			.request(opts, resolve)
			.once('error', reject)
			.end();
	});

const sslOptions = {
	key: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.key`),
	cert: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.pem`),
};

function json(res: http.IncomingMessage): Promise<Record<string, string>> {
	return new Promise((resolve) => {
		let data = '';
		res.setEncoding('utf8');
		res.on('data', (b) => {
			data += b;
		});
		res.on('end', () => resolve(JSON.parse(data)));
	});
}

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
				const info = url.parse(`http://127.0.0.1:${port}/foo`);
				const res = await req({ agent, ...info });
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
				const info = url.parse(`http://127.0.0.1:${port}/foo`);
				const res = await req({ agent, ...info });
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
				const info = url.parse(`http://127.0.0.1:${port}/foo`);
				const res = await req({ agent, ...info });
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
				const info = url.parse('http://127.0.0.1/throws');
				await req({ agent, ...info });
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
				const info = url.parse('http://127.0.0.1/throws');
				await req({ agent, ...info });
			} catch (err: unknown) {
				gotError = true;
				assert.equal((err as Error).message, 'bad');
			}

			assert(gotError);
			assert(gotCallback);
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
				const info = url.parse(`https://127.0.0.1:${port}/foo`);
				const res = await req({
					agent,
					rejectUnauthorized: false,
					...info,
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
				const info = url.parse(`https://127.0.0.1:${port}/foo`);
				const res = await req({
					agent: agent1,
					rejectUnauthorized: false,
					...info,
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
				const info = url.parse(`https://127.0.0.1:${port}/foo`);
				const res = await req({
					agent,
					rejectUnauthorized: false,
					...info,
				});
				const body = await json(res);
				assert.equal(body.host, '127.0.0.1');
				assert.equal(reqCount, 1);
			} finally {
				server.close();
			}
		});
	});
});
