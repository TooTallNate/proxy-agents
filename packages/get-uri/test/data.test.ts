/**
 * Module dependencies.
 */

import { getUri } from '../src';
import { toBuffer } from './util';

describe('get-uri', () => {
	describe('"data:" protocol', () => {
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
