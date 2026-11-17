import { getUri } from '../src';
import { toBuffer } from './util';

describe('get-uri', () => {
	describe('"data:" protocol', () => {
		it('should preserve UTF-8 and literal nonstandard percent escapes', async () => {
			const stream = await getUri('data:,你好%FF%u2026');
			expect(await toBuffer(stream)).toEqual(
				Buffer.concat([
					Buffer.from('你好'),
					Buffer.from([0xff]),
					Buffer.from('%u2026'),
				])
			);
		});

		it('should work for URL-encoded data', async () => {
			const stream = await getUri('data:,Hello%2C%20World!');
			const buf = await toBuffer(stream);
			expect(buf.toString()).toEqual('Hello, World!');
		});

		it('should work for base64-encoded data', async () => {
			const stream = await getUri(
				'data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D'
			);
			const buf = await toBuffer(stream);
			expect(buf.toString()).toEqual('Hello, World!');
		});

		it('should return ENOTMODIFIED for the same URI with `cache`', async () => {
			const cache = await getUri('data:,Hello%2C%20World!');
			await expect(
				getUri('data:,Hello%2C%20World!', { cache })
			).rejects.toHaveProperty('code', 'ENOTMODIFIED');
		});
	});
});
