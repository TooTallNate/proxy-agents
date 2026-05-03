export interface BasicAuthResult {
	scheme: string;
	username?: string;
	password?: string;
}

export function basicAuthParser(auth: string): BasicAuthResult {
	const parts = auth.split(' ');
	const scheme = parts[0];
	if (scheme !== 'Basic') {
		return { scheme };
	}
	const decoded = Buffer.from(parts[1], 'base64').toString('utf-8');
	const colon = decoded.indexOf(':');
	const username = decoded.substring(0, colon);
	const password = decoded.substring(colon + 1);
	return { scheme, username, password };
}
