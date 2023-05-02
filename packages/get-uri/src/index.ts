import createDebug from 'debug';
import { Readable } from 'stream';

// Built-in protocols
import { data } from './data';
import { file } from './file';
import { ftp } from './ftp';
import { http } from './http';
import { https } from './https';

const debug = createDebug('get-uri');

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type Protocol<T> = T extends `${infer Protocol}:${infer _}` ? Protocol : never;

export type GetUriProtocol<T> = (parsed: URL, opts?: T) => Promise<Readable>;

export const protocols = {
	data,
	file,
	ftp,
	http,
	https,
};

export type Protocols = typeof protocols;

export type ProtocolsOptions = {
	[P in keyof Protocols]: NonNullable<Parameters<Protocols[P]>[1]>;
};

export type ProtocolOpts<T> = {
	[P in keyof ProtocolsOptions]: Protocol<T> extends P
		? ProtocolsOptions[P]
		: never;
}[keyof Protocols];

const VALID_PROTOCOLS = new Set(Object.keys(protocols));

export function isValidProtocol(p: string): p is keyof Protocols {
	return VALID_PROTOCOLS.has(p);
}

/**
 * Async function that returns a `stream.Readable` instance that will output
 * the contents of the given URI.
 *
 * For caching purposes, you can pass in a `stream` instance from a previous
 * `getUri()` call as a `cache: stream` option, and if the destination has
 * not changed since the last time the endpoint was retreived then the callback
 * will be invoked with an Error object with `code` set to "ENOTMODIFIED" and
 * `null` for the "stream" instance argument. In this case, you can skip
 * retreiving the file again and continue to use the previous payload.
 *
 * @param {String} uri URI to retrieve
 * @param {Object} opts optional "options" object
 * @api public
 */
export async function getUri<Uri extends string>(
	uri: Uri | URL,
	opts?: ProtocolOpts<Uri>
): Promise<Readable> {
	debug('getUri(%o)', uri);

	if (!uri) {
		throw new TypeError('Must pass in a URI to "getUri()"');
	}

	const url = typeof uri === 'string' ? new URL(uri) : uri;

	// Strip trailing `:`
	const protocol = url.protocol.replace(/:$/, '');
	if (!isValidProtocol(protocol)) {
		throw new TypeError(
			`Unsupported protocol "${protocol}" specified in URI: "${uri}"`
		);
	}

	const getter = protocols[protocol];
	return getter(url, opts as never);
}
