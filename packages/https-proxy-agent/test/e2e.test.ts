import { req, json } from 'agent-base';
import { HttpsProxyAgent } from '../src';

interface NordVPNServer {
	name: string;
	domain: string;
	flag: string;
	features: { [key: string]: boolean };
}

jest.setTimeout(30000);

async function findNordVpnServer(): Promise<NordVPNServer> {
	const res = await req('https://nordvpn.com/api/server');
	const body = await json(res);
	const server = (body as NordVPNServer[]).find((s) => s.features.proxy_ssl);
	if (!server) {
		throw new Error('Could not find `https` proxy server from NordVPN');
	}
	return server;
}

async function getRealIP(): Promise<string> {
	const res = await req('https://dump.n8.io');
	const body = await json(res);
	return body.request.headers['x-real-ip'];
}

describe('HttpsProxyAgent', () => {
	it('should work over NordVPN proxy', async () => {
		const { NORDVPN_USERNAME, NORDVPN_PASSWORD } = process.env;
		if (!NORDVPN_USERNAME) {
			throw new Error('`NORDVPN_USERNAME` env var is not defined');
		}
		if (!NORDVPN_PASSWORD) {
			throw new Error('`NORDVPN_PASSWORD` env var is not defined');
		}

		const [realIp, server] = await Promise.all([
			getRealIP(),
			findNordVpnServer(),
		]);
		console.log(
			`Using NordVPN HTTPS proxy server: ${server.name} (${server.domain})`
		);

		const username = encodeURIComponent(NORDVPN_USERNAME);
		const password = encodeURIComponent(NORDVPN_PASSWORD);

		// NordVPN runs their HTTPS proxy servers on port 89
		// https://www.reddit.com/r/nordvpn/comments/hvz48h/nordvpn_https_proxy/
		const agent = new HttpsProxyAgent(
			`https://${username}:${password}@${server.domain}:89`
		);

		const res = await req('https://dump.n8.io', { agent });
		const body = await json(res);
		expect(body.request.headers['x-real-ip']).not.toEqual(realIp);
		expect(body.request.headers['x-vercel-ip-country']).toEqual(
			server.flag
		);
	});
});
