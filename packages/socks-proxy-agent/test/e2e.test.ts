import retry from 'async-retry';
import { req, json } from 'agent-base';
import { SocksProxyAgent } from '../src';

interface NordVPNServer {
	name: string;
	domain: string;
	flag: string;
	features: { [key: string]: boolean };
}

jest.setTimeout(30000);

const findNordVpnServer = () =>
	retry(
		async (): Promise<NordVPNServer> => {
			const res = await req('https://nordvpn.com/api/server');
			if (res.statusCode !== 200) {
				res.socket.destroy();
				throw new Error(`Status code: ${res.statusCode}`);
			}
			const body = await json(res);
			const servers = (body as NordVPNServer[]).filter(
				(s) => s.features.socks
			);
			if (servers.length === 0) {
				throw new Error(
					'Could not find `socks` proxy server from NordVPN'
				);
			}
			const server = servers[Math.floor(Math.random() * servers.length)];
			return server;
		},
		{
			retries: 5,
			onRetry(err, attempt) {
				console.log(
					`Failed to get NordVPN servers. Retrying… (attempt #${attempt}, ${err.message})`
				);
			},
		}
	);

async function getRealIP(): Promise<string> {
	const res = await req('https://dump.n8.io');
	const body = await json(res);
	return body.request.headers['x-real-ip'];
}

describe('SocksProxyAgent', () => {
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
			`Using NordVPN SOCKS proxy server: ${server.name} (${server.domain})`
		);

		const username = encodeURIComponent(NORDVPN_USERNAME);
		const password = encodeURIComponent(NORDVPN_PASSWORD);

		const agent = new SocksProxyAgent(
			`socks://${username}:${password}@${server.domain}`
		);

		const res = await req('https://dump.n8.io', { agent });
		const body = await json(res);
		expect(body.request.headers['x-real-ip']).not.toEqual(realIp);
		expect(body.request.headers['x-vercel-ip-country']).toEqual(
			server.flag
		);
	});
});
