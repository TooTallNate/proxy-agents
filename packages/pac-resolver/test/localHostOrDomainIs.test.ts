import localHostOrDomainIs from '../src/localHostOrDomainIs';

describe('localHostOrDomainIs(host, hostdom)', () => {
	test.each([
		{
			host: 'www.netscape.com',
			hostdom: 'www.netscape.com',
			expected: true,
		},
		{ host: 'www', hostdom: 'www.netscape.com', expected: true },
		{ host: 'www.mcom.com', hostdom: 'www.netscape.com', expected: false },
		{
			host: 'home.netscape.com',
			hostdom: 'www.netscape.com',
			expected: false,
		},
	])(
		'should return `$expected` for "$host", "$hostdom"',
		({ host, hostdom, expected }) => {
			expect(localHostOrDomainIs(host, hostdom)).toEqual(expected);
		}
	);
});
