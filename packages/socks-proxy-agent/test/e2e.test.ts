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

import { vi } from 'vitest';
vi.setConfig({ testTimeout: 120000 });

async function getRealIP(): Promise<string> {
	const res = await req('https://dump.n8.io');
	const body = await json(res);
	return body.request.headers['x-real-ip'];
}

describe('SocksProxyAgent', () => {
	let servers: NordVPNServer[];

	it('should find NordVPN "socks" servers', async () => {
		servers = await retry(
			async (): Promise<NordVPNServer[]> => {
				const res = await req(
					'https://api.nordvpn.com/v1/servers?limit=0'
				);
				if (res.statusCode !== 200) {
					res.socket.destroy();
					throw new Error(`Status code: ${res.statusCode}`);
				}
				const body = await json(res);
				const filtered = (body as NordVPNServer[]).filter(
					(s) =>
						s.status === 'online' &&
						s.technologies.find((t) => t.identifier === 'socks')
				);
				if (filtered.length === 0) {
					throw new Error(
						'Could not find `socks` proxy server from NordVPN'
					);
				}
				return filtered;
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
		console.log(`Found ${servers.length} NordVPN "socks" servers`);
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

		await retry(
			async () => {
				const server =
					servers[Math.floor(Math.random() * servers.length)];
				console.log(
					`Trying NordVPN server: ${server.name} (${server.hostname})`
				);

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
			},
			{
				retries: 3,
				onRetry(err, attempt) {
					console.log(
						`Proxy test failed, retrying with different server… (attempt #${attempt}, ${err.message})`
					);
				},
			}
		);
	});
});
