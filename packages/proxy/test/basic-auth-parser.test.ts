import { basicAuthParser } from '../src/basic-auth-parser';

describe('basicAuthParser', () => {
	it('should parse Basic auth header', () => {
		const result = basicAuthParser('Basic YWRtaW46cGFzc3dvcmQ=');
		expect(result).toEqual({
			scheme: 'Basic',
			username: 'admin',
			password: 'password',
		});
	});

	it('should return only scheme for non-Basic auth', () => {
		const result = basicAuthParser('Digest DEADC0FFEE');
		expect(result).toEqual({ scheme: 'Digest' });
	});

	it('should handle colons in password', () => {
		const result = basicAuthParser('Basic YWRtaW46cGFzczp3b3Jk');
		expect(result).toEqual({
			scheme: 'Basic',
			username: 'admin',
			password: 'pass:word',
		});
	});
});
