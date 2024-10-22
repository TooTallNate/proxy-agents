import { Readable } from 'stream';
import createDebug from 'debug';
import { Stats, createReadStream, promises as fsPromises } from 'fs';
import { GetUriProtocol } from './';
import NotFoundError from './notfound';
import NotModifiedError from './notmodified';
import { fileURLToPath } from 'url';

const debug = createDebug('get-uri:file');

type ReadStreamOptions = NonNullable<
	Exclude<Parameters<typeof createReadStream>[1], string>
>;

interface FileReadable extends Readable {
	stat?: Stats;
}

export interface FileOptions extends ReadStreamOptions {
	cache?: FileReadable;
}

/**
 * Returns a `fs.ReadStream` instance from a "file:" URI.
 */

export const file: GetUriProtocol<FileOptions> = async (
	{ href: uri },
	opts = {}
) => {
	const {
		cache,
		flags = 'r',
		mode = 438, // =0666
	} = opts;

	try {
		// Convert URI → Path
		const filepath = fileURLToPath(uri);
		debug('Normalized pathname: %o', filepath);

		// `open()` first to get a file descriptor and ensure that the file
		// exists.
		const fdHandle = await fsPromises.open(filepath, flags, mode);
		// extract the numeric file descriptor
		const fd = fdHandle.fd;

		// store the stat object for the cache.
		const stat = await fdHandle.stat();

		// if a `cache` was provided, check if the file has not been modified
		if (cache && cache.stat && stat && isNotModified(cache.stat, stat)) {
			throw new NotModifiedError();
		}

		// `fs.ReadStream` takes care of calling `fs.close()` on the
		// fd after it's done reading
		const rs = createReadStream(filepath, {
			autoClose: true,
			...opts,
			fd,
		}) as FileReadable;
		rs.stat = stat;
		return rs;
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			throw new NotFoundError();
		}
		throw err;
	}
};

// returns `true` if the `mtime` of the 2 stat objects are equal
function isNotModified(prev: Stats, curr: Stats): boolean {
	return +prev.mtime === +curr.mtime;
}
