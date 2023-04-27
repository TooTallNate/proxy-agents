import { dnsLookup } from './util';

/**
 * Resolves the given DNS hostname into an IP address, and returns it in the dot
 * separated format as a string.
 *
 * Example:
 *
 * ``` js
 * dnsResolve("home.netscape.com")
 *   // returns the string "198.95.249.79".
 * ```
 *
 * @param {String} host hostname to resolve
 * @return {String} resolved IP address
 */

export default async function dnsResolve(host: string): Promise<string | null> {
	const family = 4;
	try {
		const r = await dnsLookup(host, { family });
		if (typeof r === 'string') {
			return r;
		}
	} catch (err) {
		// @ignore
	}
	return null;
}
