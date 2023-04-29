// @ts-expect-error no `@types/st`
import st from 'st';
import path from 'path';
import http from 'http';
import https from 'https';
import { listen } from 'async-listen';
import { readFile, readFileSync } from 'fs-extra';
import { getUri } from '../src';
import { toBuffer } from './util';

describe('get-uri', () => {
	describe('http/https redirects', () => {
		let httpServer: http.Server;
		let httpsServer: https.Server;
		let httpPort: number;
		let httpsPort: number;

		beforeAll(async () => {
			httpServer = http.createServer();
			await listen(httpServer);
			// @ts-expect-error `port` is definitely a number
			httpPort = httpServer.address().port;
		});

		beforeAll(async () => {
			httpsServer = https.createServer({
				key: readFileSync(`${__dirname}/server.key`),
				cert: readFileSync(`${__dirname}/server.crt`),
			});
			await listen(httpsServer);
			// @ts-expect-error `port` is definitely a number
			httpsPort = httpsServer.address().port;
		});

		afterAll(() => {
			httpsServer.close();
			httpServer.close();
		});

		it('should handle http -> https redirect', async () => {
			const dest = `https://127.0.0.1:${httpsPort}/${path.basename(
				__filename
			)}`;
			httpsServer.once('request', st(__dirname));
			httpServer.once('request', (_req, res) => {
				res.statusCode = 301;
				res.setHeader('location', dest);
				res.end('Moved');
			});

			const actual = await readFile(__filename, 'utf8');
			const stream = await getUri(
				`http://127.0.0.1:${httpPort}/${path.basename(__filename)}`,
				{ headers: { connection: 'close' }, rejectUnauthorized: false }
			);
			const buf = await toBuffer(stream);
			expect(buf.toString()).toEqual(actual);
		});

		it('should handle https -> http redirect', async () => {
			const dest = `http://127.0.0.1:${httpPort}/${path.basename(
				__filename
			)}`;
			httpServer.once('request', st(__dirname));
			httpsServer.once('request', (_req, res) => {
				res.statusCode = 301;
				res.setHeader('location', dest);
				res.end('Moved');
			});

			const actual = await readFile(__filename, 'utf8');
			const stream = await getUri(
				`https://127.0.0.1:${httpsPort}/${path.basename(__filename)}`,
				{ headers: { connection: 'close' }, rejectUnauthorized: false }
			);
			const buf = await toBuffer(stream);
			expect(buf.toString()).toEqual(actual);
		});
	});
});
