import http_ from 'http';
import https from 'https';
import once from '@tootallnate/once';
import createDebug from 'debug';
import { Readable } from 'stream';
import { GetUriProtocol } from '.';
import HTTPError from './http-error';
import NotFoundError from './notfound';
import NotModifiedError from './notmodified';

const debug = createDebug('get-uri:http');

type HttpOrHttpsModule = typeof http_ | typeof https;

export interface HttpReadableProps {
	date?: number;
	parsed?: URL;
	redirects?: HttpReadable[];
}

export interface HttpReadable extends Readable, HttpReadableProps {}

export interface HttpIncomingMessage
	extends http_.IncomingMessage,
		HttpReadableProps {}

export interface HttpOptions extends https.RequestOptions {
	cache?: HttpReadable;
	http?: HttpOrHttpsModule;
	redirects?: HttpReadable[];
	maxRedirects?: number;
}

/**
 * Returns a Readable stream from an "http:" URI.
 */
export const http: GetUriProtocol<HttpOptions> = async (url, opts = {}) => {
	debug('GET %o', url.href);

	const cache = getCache(url, opts.cache);

	// first check the previous Expires and/or Cache-Control headers
	// of a previous response if a `cache` was provided
	if (cache && isFresh(cache) && typeof cache.statusCode === 'number') {
		// check for a 3xx "redirect" status code on the previous cache
		const type = (cache.statusCode / 100) | 0;
		if (type === 3 && cache.headers.location) {
			debug('cached redirect');
			throw new Error('TODO: implement cached redirects!');
		}
		// otherwise we assume that it's the destination endpoint,
		// since there's nowhere else to redirect to
		throw new NotModifiedError();
	}

	// 5 redirects allowed by default
	const maxRedirects =
		typeof opts.maxRedirects === 'number' ? opts.maxRedirects : 5;
	debug('allowing %o max redirects', maxRedirects);

	let mod;
	if (opts.http) {
		// the `https` module passed in from the "http.js" file
		mod = opts.http;
		debug('using secure `https` core module');
	} else {
		mod = http_;
		debug('using `http` core module');
	}

	const options = { ...opts };

	// add "cache validation" headers if a `cache` was provided
	if (cache) {
		if (!options.headers) {
			options.headers = {};
		}

		const lastModified = cache.headers['last-modified'];
		if (lastModified) {
			options.headers['If-Modified-Since'] = lastModified;
			debug('added "If-Modified-Since" request header: %o', lastModified);
		}

		const etag = cache.headers.etag;
		if (etag) {
			options.headers['If-None-Match'] = etag;
			debug('added "If-None-Match" request header: %o', etag);
		}
	}

	const req = mod.get(url, options);
	const [res]: [HttpIncomingMessage] = await once(req, 'response');
	const code = res.statusCode || 0;

	// assign a Date to this response for the "Cache-Control" delta calculation
	res.date = Date.now();
	res.parsed = url;

	debug('got %o response status code', code);

	// any 2xx response is a "success" code
	const type = (code / 100) | 0;

	// check for a 3xx "redirect" status code
	const location = res.headers.location;
	if (type === 3 && location) {
		if (!opts.redirects) opts.redirects = [];
		const redirects = opts.redirects;

		if (redirects.length < maxRedirects) {
			debug('got a "redirect" status code with Location: %o', location);

			// flush this response - we're not going to use it
			res.resume();

			// hang on to this Response object for the "redirects" Array
			redirects.push(res);

			const newUri = new URL(location, url.href);
			debug('resolved redirect URL: %o', newUri.href);

			const left = maxRedirects - redirects.length;
			debug('%o more redirects allowed after this one', left);

			// check if redirecting to a different protocol
			if (newUri.protocol !== url.protocol) {
				opts.http = newUri.protocol === 'https:' ? https : undefined;
			}

			return http(newUri, opts);
		}
	}

	// if we didn't get a 2xx "success" status code, then create an Error object
	if (type !== 2) {
		res.resume();
		if (code === 304) {
			throw new NotModifiedError();
		} else if (code === 404) {
			throw new NotFoundError();
		}
		// other HTTP-level error
		throw new HTTPError(code);
	}

	if (opts.redirects) {
		// store a reference to the "redirects" Array on the Response object so that
		// they can be inspected during a subsequent call to GET the same URI
		res.redirects = opts.redirects;
	}

	return res;
};

/**
 * Returns `true` if the provided cache's "freshness" is valid. That is, either
 * the Cache-Control header or Expires header values are still within the allowed
 * time period.
 *
 * @return {Boolean}
 * @api private
 */

function isFresh(cache: HttpIncomingMessage): boolean {
	let fresh = false;
	let expires = parseInt(cache.headers.expires || '', 10);
	const cacheControl = cache.headers['cache-control'];

	if (cacheControl) {
		// for Cache-Control rules, see: http://www.mnot.net/cache_docs/#CACHE-CONTROL
		debug('Cache-Control: %o', cacheControl);

		const parts = cacheControl.split(/,\s*?\b/);
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			const subparts = part.split('=');
			const name = subparts[0];
			switch (name) {
				case 'max-age':
					expires =
						(cache.date || 0) + parseInt(subparts[1], 10) * 1000;
					fresh = Date.now() < expires;
					if (fresh) {
						debug(
							'cache is "fresh" due to previous %o Cache-Control param',
							part
						);
					}
					return fresh;
				case 'must-revalidate':
					// XXX: what we supposed to do here?
					break;
				case 'no-cache':
				case 'no-store':
					debug(
						'cache is "stale" due to explicit %o Cache-Control param',
						name
					);
					return false;
				default:
					// ignore unknown cache value
					break;
			}
		}
	} else if (expires) {
		// for Expires rules, see: http://www.mnot.net/cache_docs/#EXPIRES
		debug('Expires: %o', expires);
		fresh = Date.now() < expires;
		if (fresh) {
			debug('cache is "fresh" due to previous Expires response header');
		}
		return fresh;
	}

	return false;
}

/**
 * Attempts to return a previous Response object from a previous GET call to the
 * same URI.
 *
 * @api private
 */

function getCache(url: URL, cache?: HttpReadable): HttpIncomingMessage | null {
	if (cache) {
		if (cache.parsed && cache.parsed.href === url.href) {
			return cache as HttpIncomingMessage;
		}
		if (cache.redirects) {
			for (let i = 0; i < cache.redirects.length; i++) {
				const c = getCache(url, cache.redirects[i]);
				if (c) {
					return c as HttpIncomingMessage;
				}
			}
		}
	}
	return null;
}
