import isPlainHostName from '../src/isPlainHostName';

describe('isPlainHostName(host)', function () {
	test.each([
		{ input: 'www', expected: true },
		{ input: 'www.netscape.com', expected: false },
	])('should return `$expected` for "$input"', ({ input, expected }) => {
		expect(isPlainHostName(input)).toEqual(expected);
	});
});
