import { Context } from 'vm';
import { CompileOptions, compile } from 'degenerator';

/**
 * Built-in PAC functions.
 */
import dateRange from './dateRange';
import dnsDomainIs from './dnsDomainIs';
import dnsDomainLevels from './dnsDomainLevels';
import dnsResolve from './dnsResolve';
import isInNet from './isInNet';
import isPlainHostName from './isPlainHostName';
import isResolvable from './isResolvable';
import localHostOrDomainIs from './localHostOrDomainIs';
import myIpAddress from './myIpAddress';
import shExpMatch from './shExpMatch';
import timeRange from './timeRange';
import weekdayRange from './weekdayRange';

/**
 * Returns an asynchronous `FindProxyForURL()` function
 * from the given JS string (from a PAC file).
 */
export function createPacResolver(
	_str: string | Buffer,
	_opts: PacResolverOptions = {}
) {
	const str = Buffer.isBuffer(_str) ? _str.toString('utf8') : _str;

	// The sandbox to use for the `vm` context.
	const context: Context = {
		...sandbox,
		..._opts.sandbox,
	};

	const opts: PacResolverOptions = {
		filename: 'proxy.pac',
		..._opts,
		sandbox: context,
	};

	// Construct the array of async function names to add `await` calls to.
	const names = Object.keys(context).filter((k) =>
		isAsyncFunction(context[k])
	);

	// Compile the JS `FindProxyForURL()` function into an async function.
	const resolver = compile<string, [url: string, host: string]>(
		str,
		'FindProxyForURL',
		names,
		opts
	);

	function FindProxyForURL(
		url: string | URL,
		_host?: string
	): Promise<string> {
		const urlObj = typeof url === 'string' ? new URL(url) : url;
		const host = _host || urlObj.hostname;

		if (!host) {
			throw new TypeError('Could not determine `host`');
		}

		return resolver(urlObj.href, host);
	}

	Object.defineProperty(FindProxyForURL, 'toString', {
		value: () => resolver.toString(),
		enumerable: false,
	});

	return FindProxyForURL;
}

export type GMT = 'GMT';
export type Hour =
	| 0
	| 1
	| 2
	| 3
	| 4
	| 5
	| 6
	| 7
	| 8
	| 9
	| 10
	| 11
	| 12
	| 13
	| 14
	| 15
	| 16
	| 17
	| 18
	| 19
	| 20
	| 21
	| 22
	| 23;
export type Day =
	| 1
	| 2
	| 3
	| 4
	| 5
	| 6
	| 7
	| 8
	| 9
	| 10
	| 11
	| 12
	| 13
	| 14
	| 15
	| 16
	| 17
	| 18
	| 19
	| 20
	| 21
	| 22
	| 23
	| 24
	| 25
	| 26
	| 27
	| 28
	| 29
	| 30
	| 31;
export type Weekday = 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';
export type Month =
	| 'JAN'
	| 'FEB'
	| 'MAR'
	| 'APR'
	| 'MAY'
	| 'JUN'
	| 'JUL'
	| 'AUG'
	| 'SEP'
	| 'OCT'
	| 'NOV'
	| 'DEC';
export type PacResolverOptions = CompileOptions;
export interface FindProxyForURLCallback {
	(err?: Error | null, result?: string): void;
}
export type FindProxyForURL = ReturnType<typeof createPacResolver>;

export const sandbox = Object.freeze({
	alert: (message = '') => console.log('%s', message),
	dateRange,
	dnsDomainIs,
	dnsDomainLevels,
	dnsResolve,
	isInNet,
	isPlainHostName,
	isResolvable,
	localHostOrDomainIs,
	myIpAddress,
	shExpMatch,
	timeRange,
	weekdayRange,
});

function toCallback<T>(
	promise: Promise<T>,
	callback: (err: Error | null, result?: T) => void
): void {
	promise.then((rtn) => callback(null, rtn), callback);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAsyncFunction(v: any): boolean {
	if (typeof v !== 'function') return false;
	// Native `AsyncFunction`
	if (v.constructor.name === 'AsyncFunction') return true;
	// TypeScript compiled
	if (String(v).indexOf('__awaiter(') !== -1) return true;
	// Legacy behavior - set `async` property on the function
	return Boolean(v.async);
}
