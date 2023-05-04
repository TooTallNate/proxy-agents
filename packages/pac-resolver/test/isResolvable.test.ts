import isResolvable from '../src/isResolvable';

describe('isResolvable(host)', () => {
	test.each([
		{ input: 'www.netscape.com', expected: true },
		{ input: 'bogus.domain.foobar', expected: false },
	])(
		'should return `$expected` for "$input"',
		async ({ input, expected }) => {
			const res = await isResolvable(input);
			expect(res).toEqual(expected);
		}
	);
});
