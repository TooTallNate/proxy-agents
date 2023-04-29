import { readFile, readFileSync } from 'fs-extra';
// @ts-expect-error no `@types/st`
import st from 'st';
import path from 'path';
import https from 'https';
import { listen } from 'async-listen';
import { getUri } from '../src';
import { toBuffer } from './util';

describe('get-uri', () => {
	describe('"https:" protocol', () => {
		let port: number;
		let server: https.Server;

		beforeAll(async () => {
			// setup target HTTPS server
			const options = {
				key: readFileSync(`${__dirname}/server.key`),
				cert: readFileSync(`${__dirname}/server.crt`),
			};
			server = https.createServer(options, st(__dirname));
			await listen(server);
			// @ts-expect-error `port` is definitely defined
			port = server.address().port;
		});

		afterAll(() => {
			server.close();
		});

		it('should work for HTTPS endpoints', async () => {
			const actual = await readFile(__filename, 'utf8');
			const stream = await getUri(
				`https://127.0.0.1:${port}/${path.basename(__filename)}`,
				{ headers: { connection: 'close' }, rejectUnauthorized: false }
			);
			const buf = await toBuffer(stream);
			expect(buf.toString()).toEqual(actual);
		});

		it('should return ENOTFOUND for bad filenames', async () => {
			await expect(
				getUri(`https://127.0.0.1:${port}/does-not-exist`, {
					headers: { connection: 'close' },
					rejectUnauthorized: false,
				})
			).rejects.toHaveProperty('code', 'ENOTFOUND');
		});

		it('should return ENOTMODIFIED for the same URI with `cache`', async () => {
			const cache = await getUri(
				`https://127.0.0.1:${port}/${path.basename(__filename)}`,
				{ headers: { connection: 'close' }, rejectUnauthorized: false }
			);
			await expect(
				getUri(
					`https://127.0.0.1:${port}/${path.basename(__filename)}`,
					{
						cache,
						headers: { connection: 'close' },
						rejectUnauthorized: false,
					}
				)
			).rejects.toHaveProperty('code', 'ENOTMODIFIED');
		});
	});
});
