import timeRange from '../src/timeRange';

const vanillaGetHours = Date.prototype.getHours;
const vanillaGetUTCHours = Date.prototype.getUTCHours;
const vanillaGetUTCMinutes = Date.prototype.getUTCMinutes;
const vanillaGetUTCSeconds = Date.prototype.getUTCSeconds;

describe('hooks', () => {
	beforeAll(() => {
		// Setting local time as 01:24:30
		Date.prototype.getHours = () => {
			return 1;
		};
		Date.prototype.getMinutes = () => {
			return 24;
		};
		Date.prototype.getSeconds = () => {
			return 30;
		};

		// Setting UTC time as 19:54:30
		Date.prototype.getUTCHours = () => {
			return 19;
		};
		Date.prototype.getUTCMinutes = () => {
			return 54;
		};
		Date.prototype.getUTCSeconds = () => {
			return 30;
		};
	});

	afterAll(() => {
		Date.prototype.getHours = vanillaGetHours;
		Date.prototype.getUTCHours = vanillaGetUTCHours;
		Date.prototype.getUTCMinutes = vanillaGetUTCMinutes;
		Date.prototype.getUTCSeconds = vanillaGetUTCSeconds;
	});

	describe('timeRange()', () => {
		test.each([
			{ inputs: [1], expected: true },
			{ inputs: [1, 2], expected: true },
			{ inputs: [0, 0, 0, 30], expected: false },
			{ inputs: [0, 0, 0, 0, 30, 0], expected: false },
			{ inputs: [0, 0, 0, 0, 30, 0, 'GMT'], expected: false },
			{ inputs: [0, 0, 0, 20, 0, 0, 'GMT'], expected: true },
		])(
			'should return `$expected` for `$inputs`',
			({ expected, inputs }) => {
				// @ts-expect-error TS complains about `.apply()`
				// eslint-disable-next-line prefer-spread
				expect(timeRange.apply(null, inputs)).toEqual(expected);
			}
		);
	});
});
