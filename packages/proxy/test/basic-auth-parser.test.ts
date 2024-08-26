import { basicAuthParser } from '../src/basic-auth-parser';

describe('basicAuthParser', () => {

	it('Basic usage',  () => {
		const result = basicAuthParser('Basic YWRtaW46cGFzc3dvcmQ=');
		expect(result).toEqual({scheme: 'Basic', username:'admin', password:'password'});
	})
	it('Wrong Schema', ()=>{
		const result = basicAuthParser('Digest DEADC0FFEE');
		expect(result).toEqual({scheme: 'Digest'});
	})
	it('With a string and colon in password', ()=>{
		const result = basicAuthParser('Basic YWRtaW46cGFzczp3b3Jk');
		expect(result).toEqual({scheme: 'Basic', username:'admin', password:'pass:word'});
	})
})
