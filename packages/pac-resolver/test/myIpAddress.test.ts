import { isIP } from 'net';
import myIpAddress from '../src/myIpAddress';

describe('myIpAddress()', function () {
	it('should return an IPv4 address', async () => {
		const ip = await myIpAddress();
		expect(isIP(ip)).toEqual(4);
	});
});
