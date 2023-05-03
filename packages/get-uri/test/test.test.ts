import { getUri } from '../src';

describe('get-uri', () => {
	it('should throw a TypeError when no URI is given', async () => {
		await expect(getUri('')).rejects.toThrow(
			'Must pass in a URI to "getUri()"'
		);
	});

	it('should throw a TypeError when no protocol is specified', async () => {
		await expect(getUri('://bad')).rejects.toThrow('Invalid URL');
	});

	it('should throw a TypeError when an unsupported protocol is specified', async () => {
		await expect(getUri('bad://bad')).rejects.toThrow(
			'Unsupported protocol "bad" specified in URI: "bad://bad"'
		);
	});
});
