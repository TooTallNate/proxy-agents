import retry from 'async-retry';
import { req, json } from 'agent-base';
import { SocksProxyAgent } from '../src';

interface NordVPNServer {
	name: string;
	hostname: string;
	status: string;
	locations: {
		country: {
			code: string;
		};
	}[];
	technologies: {
		identifier: string;
	}[];
}

jest.setTimeout(30000);

async function getRealIP(): Promise<string> {
	const res = await req('https://dump.n8.io');
	const body = await json(res);
	return body.request.headers['x-real-ip'];
}

describe('SocksProxyAgent', () => {
	let server: NordVPNServer;

	it('should find NordVPN "socks" server', async () => {
		server = await retry(
			async (): Promise<NordVPNServer> => {
				const res = await req(
					'https://api.nordvpn.com/v1/servers?limit=0'
				);
				if (res.statusCode !== 200) {
					res.socket.destroy();
					throw new Error(`Status code: ${res.statusCode}`);
				}
				const body = await json(res);
				const servers = (body as NordVPNServer[]).filter(
					(s) =>
						s.status === 'online' &&
						s.technologies.find((t) => t.identifier === 'socks')
				);
				if (servers.length === 0) {
					throw new Error(
						'Could not find `https` proxy server from NordVPN'
					);
				}
				return servers[Math.floor(Math.random() * servers.length)];
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
		console.log(
			`Using NordVPN "socks" server: ${server.name} (${server.hostname})`
		);
	});

	it('should work over NordVPN proxy', async () => {
		const { NORDVPN_USERNAME, NORDVPN_PASSWORD } = process.env;
		if (!NORDVPN_USERNAME) {
			throw new Error('`NORDVPN_USERNAME` env var is not defined');
		}
		if (!NORDVPN_PASSWORD) {
			throw new Error('`NORDVPN_PASSWORD` env var is not defined');
		}

		const username = encodeURIComponent(NORDVPN_USERNAME);
		const password = encodeURIComponent(NORDVPN_PASSWORD);
		const agent = new SocksProxyAgent(
			`socks://${username}:${password}@${server.hostname}`
		);

		const [res, realIp] = await Promise.all([
			req('https://dump.n8.io', { agent }),
			getRealIP(),
		]);
		const body = await json(res);
		expect(body.request.headers['x-real-ip']).not.toEqual(realIp);
		expect(body.request.headers['x-vercel-ip-country']).toEqual(
			server.locations[0].country.code
		);
	});
});
