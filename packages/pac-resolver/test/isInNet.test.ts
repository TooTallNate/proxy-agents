import isInNet from '../src/isInNet';

describe('isInNet(host, pattern, mask)', () => {
	const tests = [
		['198.95.249.79', '198.95.249.79', '255.255.255.255', true],
		['198.95.249.78', '198.95.249.79', '255.255.255.255', false],
		['198.95.1.1', '198.95.0.0', '255.255.0.0', true],
		['198.94.1.1', '198.95.0.0', '255.255.0.0', false],
		[null, '198.95.0.0', '255.255.0.0', false],
	];

	tests.forEach(function (test) {
		const expected = test.pop();
		it(
			'should return `' + expected + '` for "' + test.join('", "') + '"',
			async () => {
				// @ts-expect-error bad types
				const res = await isInNet(test[0], test[1], test[2]);
				expect(res).toEqual(expected);
			}
		);
	});
});
