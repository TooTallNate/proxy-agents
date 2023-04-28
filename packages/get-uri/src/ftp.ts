import { Client, AccessOptions } from 'basic-ftp';
import { PassThrough, Readable } from 'stream';
import { basename, dirname } from 'path';
import createDebug from 'debug';
import NotFoundError from './notfound';
import NotModifiedError from './notmodified';
import { GetUriProtocol } from '.';

const debug = createDebug('get-uri:ftp');

export interface FTPReadable extends Readable {
	lastModified?: Date;
}

export interface FTPOptions extends AccessOptions {
	cache?: FTPReadable;
}

/**
 * Returns a Readable stream from an "ftp:" URI.
 */
export const ftp: GetUriProtocol<FTPOptions> = async (url, opts = {}) => {
	const { cache } = opts;
	const filepath = decodeURIComponent(url.pathname);
	let lastModified: Date | undefined;

	if (!filepath) {
		throw new TypeError('No "pathname"!');
	}

	const client = new Client();

	try {
		const host = url.hostname || url.host || 'localhost';
		const port = parseInt(url.port || '0', 10) || 21;
		const user = url.username
			? decodeURIComponent(url.username)
			: undefined;
		const password = url.password
			? decodeURIComponent(url.password)
			: undefined;

		await client.access({
			host,
			port,
			user,
			password,
			...opts,
		});

		// first we have to figure out the Last Modified date.
		// try the MDTM command first, which is an optional extension command.
		try {
			lastModified = await client.lastMod(filepath);
		} catch (err: unknown) {
			// handle the "file not found" error code
			if ((err as { code: number }).code === 550) {
				throw new NotFoundError();
			}
		}

		if (!lastModified) {
			// Try to get the last modified date via the LIST command (uses
			// more bandwidth, but is more compatible with older FTP servers
			const list = await client.list(dirname(filepath));

			// attempt to find the "entry" with a matching "name"
			const name = basename(filepath);
			const entry = list.find((e) => e.name === name);
			if (entry) {
				lastModified = entry.modifiedAt;
			}
		}

		if (lastModified) {
			if (isNotModified()) {
				throw new NotModifiedError();
			}
		} else {
			throw new NotFoundError();
		}

		const stream = new PassThrough();
		const rs = stream as FTPReadable;
		client.downloadTo(stream, filepath).then((result) => {
			debug(result.message);
			client.close();
		});
		rs.lastModified = lastModified;
		return rs;
	} catch (err) {
		client.close();
		throw err;
	}

	// called when `lastModified` is set, and a "cache" stream was provided
	function isNotModified(): boolean {
		if (cache?.lastModified && lastModified) {
			return +cache.lastModified === +lastModified;
		}
		return false;
	}
};
