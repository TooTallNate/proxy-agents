import { join } from 'path';
import { pathToFileURL } from 'url';
import { readFile } from 'fs/promises';
import { getUri } from '../src';
import { toBuffer } from './util';

describe('get-uri', () => {
	describe('"file:" protocol', () => {
		it('should work for local files', async () => {
			const actual = await readFile(__filename, 'utf8');
			const uri = pathToFileURL(__filename);
			const stream = await getUri(uri);
			const buf = await toBuffer(stream);
			expect(buf.toString()).toEqual(actual);
		});

		it('should work for files with special characters in name', async () => {
			const file = join(__dirname, 'file with special chars!');
			const actual = await readFile(file, 'utf8');
			const uri = pathToFileURL(file);
			const stream = await getUri(uri);
			const buf = await toBuffer(stream);
			expect(buf.toString()).toEqual(actual);
		});

		it('should return ENOTFOUND for bad filenames', async () => {
			const uri = pathToFileURL(`${__filename}does-not-exist`);
			await expect(getUri(uri)).rejects.toHaveProperty(
				'code',
				'ENOTFOUND'
			);
		});

		it('should return ENOTMODIFIED for the same URI with `cache`', async () => {
			const uri = pathToFileURL(__filename);
			const cache = await getUri(uri);
			await expect(getUri(uri, { cache })).rejects.toHaveProperty(
				'code',
				'ENOTMODIFIED'
			);
		});
	});
});
