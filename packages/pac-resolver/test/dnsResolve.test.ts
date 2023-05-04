import assert from 'assert';
import { isIP } from 'net';
import dnsResolve from '../src/dnsResolve';

describe('dnsResolve(host)', function () {
	test.each([
		{ input: 'www.netscape.com', expected: true },
		{ input: 'bogus.domain.foobar', expected: false },
	])(
		'should return `$expected` for "$input"',
		async ({ input, expected }) => {
			const res = await dnsResolve(input);
			if (expected) {
				assert(typeof res === 'string');
				expect(isIP(res)).toEqual(4);
			} else {
				expect(res).toBeNull();
			}
		}
	);
});
