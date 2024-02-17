import os from 'os';

export const ip = {
	address(): string {
		const interfaces = os.networkInterfaces();

		// Default to `ipv4`
		const family = normalizeFamily();

		const all = Object.values(interfaces).map((addrs = []) => {
			const addresses = addrs.filter((details) => {
				const detailsFamily = normalizeFamily(details.family);
				if (detailsFamily !== family || ip.isLoopback(details.address)) {
					return false;
				}
				return true;

			});

			return addresses.length ? addresses[0].address : undefined;
		}).filter(Boolean);

		return !all.length ? ip.loopback(family) : all[0] as string;
	},

	isLoopback(addr: string): boolean {
		return /^(::f{4}:)?127\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})/
			.test(addr)
			|| /^fe80::1$/.test(addr)
			|| /^::1$/.test(addr)
			|| /^::$/.test(addr);
	},

	loopback(family: IpFamily): string {
		// Default to `ipv4`
		family = normalizeFamily(family);

		if (family !== 'ipv4' && family !== 'ipv6') {
			throw new Error('family must be ipv4 or ipv6');
		}

		return family === 'ipv4' ? '127.0.0.1' : 'fe80::1';
	}

};

function normalizeFamily(family?: unknown): IpFamily {
	if (family === 4) {
		return 'ipv4';
	}
	if (family === 6) {
		return 'ipv6';
	}
	return family ? (family as string).toLowerCase() as IpFamily : 'ipv4';
}

type IpFamily = 'ipv4' | 'ipv6'
