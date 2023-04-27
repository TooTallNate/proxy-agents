import { basename, join } from 'path';
import { FtpServer } from 'ftpd';
import { getUri } from '../src';
import { readFile } from 'fs-extra';
import { toBuffer } from './util';

describe('get-uri', () => {
	describe('"ftp:" protocol', () => {
		let port: number;
		let server: FtpServer;

		beforeAll(async () => {
			server = new FtpServer('127.0.0.1', {
				// @ts-expect-error ...
				logLevel: -1,
				getInitialCwd(_socket, fn) {
					// @ts-expect-error ...
					fn?.(undefined, '/');
				},
				getRoot() {
					return __dirname;
				},
			});

			server.on('client:connected', (conn) => {
				let username: string;
				// @ts-expect-error ...
				conn.on('command:user', (user, success) => {
					username = user;
					success();
				});
				// @ts-expect-error ...
				conn.on('command:pass', (pass, success) => {
					success(username);
				});
			});

			port = await new Promise<number>((r) =>
				// @ts-expect-error ...
				server.listen(0, () => {
					// @ts-expect-error ...
					r(server.server.address().port);
				})
			);
		});

		afterAll(() => {
			server.close();
		});

		it('should work for ftp endpoints', async () => {
			const actual = await readFile(__filename, 'utf8');
			const stream = await getUri(
				`ftp://127.0.0.1:${port}/${basename(__filename)}`
			);
			const buf = await toBuffer(stream);
			expect(buf.toString()).toEqual(actual);
		});

		it('should work for files with special characters in name', async () => {
			const file = join(__dirname, 'file with special chars!');
			const actual = await readFile(file, 'utf8');
			const url = new URL(`ftp://127.0.0.1:${port}`);
			url.pathname = basename(file);
			const stream = await getUri(url);
			const buf = await toBuffer(stream);
			expect(buf.toString()).toEqual(actual);
		});

		it('should return ENOTFOUND for bad filenames', async () => {
			await expect(
				getUri(`ftp://127.0.0.1:${port}/does-not-exist`)
			).rejects.toHaveProperty('code', 'ENOTFOUND');
		});

		it('should return ENOTMODIFIED for the same URI with `cache`', async () => {
			const cache = await getUri(
				`ftp://127.0.0.1:${port}/${basename(__filename)}`
			);
			await expect(
				getUri(`ftp://127.0.0.1:${port}/${basename(__filename)}`, {
					cache,
				})
			).rejects.toHaveProperty('code', 'ENOTMODIFIED');
		});
	});
});
