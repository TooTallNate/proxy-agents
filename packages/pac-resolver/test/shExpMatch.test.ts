import shExpMatch from '../src/shExpMatch';

describe('shExpMatch(str, shexp)', () => {
	test.each([
		{
			str: 'http://home.netscape.com/people/ari/index.html',
			shexp: '*/ari/*',
			expected: true,
		},
		{
			str: 'http://home.netscape.com/people/montulli/index.html',
			shexp: '*/ari/*',
			expected: false,
		},
		{
			str: 'http://home.example.com/people/yourpage/index.html',
			shexp: '.*/mypage/.*',
			expected: false,
		},
		{ str: 'www.hotmail.com', shexp: '*hotmail.com*', expected: true },
		{
			str: 'phishing-scam.com?email=someone@hotmail.com',
			shexp: '*hotmail.com*',
			expected: true,
		},
		{
			str: 'abcdomain.com',
			shexp: '(*.abcdomain.com|abcdomain.com)',
			expected: true,
		},
		{
			str: 'foo.abcdomain.com',
			shexp: '(*.abcdomain.com|abcdomain.com)',
			expected: true,
		},
		{
			str: 'abddomain.com',
			shexp: '(*.abcdomain.com|abcdomain.com)',
			expected: false,
		},
		{ str: 'abcdomain.com', shexp: '*.n.com', expected: false },
		{ str: 'a.com', shexp: '?.com', expected: true },
		{ str: 'b.com', shexp: '?.com', expected: true },
		{ str: 'ab.com', shexp: '?.com', expected: false },
	])(
		'should return `$expected` for "$str", "$shexp"',
		({ str, shexp, expected }) => {
			expect(shExpMatch(str, shexp)).toEqual(expected);
		}
	);
});
