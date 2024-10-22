// @ts-expect-error no `@types/st`
import st from 'st';
import path from 'path';
import http from 'http';
import { listen } from 'async-listen';
import { readFile } from 'fs/promises';
import { getUri } from '../src';
import { toBuffer } from './util';

describe('get-uri', () => {
	describe('"http:" protocol', () => {
		let port: number;
		let server: http.Server;

		beforeAll(async () => {
			// setup target HTTP server
			server = http.createServer(st(__dirname));
			await listen(server);
			// @ts-expect-error `port` definitely exists
			port = server.address().port;
		});

		afterAll(() => {
			server.close();
		});

		it('should work for HTTP endpoints', async () => {
			const actual = await readFile(__filename, 'utf8');
			const stream = await getUri(
				`http://127.0.0.1:${port}/${path.basename(__filename)}`
			);
			const buf = await toBuffer(stream);
			expect(buf.toString()).toEqual(actual);
		});

		it('should return ENOTFOUND for bad filenames', async () => {
			await expect(
				getUri(`http://127.0.0.1:${port}/does-not-exist`)
			).rejects.toHaveProperty('code', 'ENOTFOUND');
		});

		it('should return ENOTMODIFIED for the same URI with `cache`', async () => {
			const cache = await getUri(
				`http://127.0.0.1:${port}/${path.basename(__filename)}`
			);
			await expect(
				getUri(
					`http://127.0.0.1:${port}/${path.basename(__filename)}`,
					{
						cache,
					}
				)
			).rejects.toHaveProperty('code', 'ENOTMODIFIED');
		});
	});
});
