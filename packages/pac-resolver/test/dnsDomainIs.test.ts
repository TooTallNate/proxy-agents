import dnsDomainIs from '../src/dnsDomainIs';

describe('dnsDomainIs(host, domain)', () => {
	test.each([
		{ host: 'www.netscape.com', domain: '.netscape.com', expected: true },
		{ host: 'www', domain: '.netscape.com', expected: false },
		{ host: 'www.mcom.com', domain: '.netscape.com', expected: false },
	])(
		'should return `$expected` for "$host, $domain"',
		({ host, domain, expected }) => {
			expect(dnsDomainIs(host, domain)).toEqual(expected);
		}
	);
});
