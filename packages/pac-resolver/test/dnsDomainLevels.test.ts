import dnsDomainLevels from '../src/dnsDomainLevels';

describe('dnsDomainLevels(host)', () => {
	test.each([
		{ input: 'www', expected: 0 },
		{ input: 'www.netscape', expected: 1 },
		{ input: 'www.netscape.com', expected: 2 },
	])('should return `$expected` for "$input"', ({ input, expected }) => {
		expect(dnsDomainLevels(input)).toEqual(expected);
	});
});
