import https_ from 'https';
import { http, HttpOptions } from './http.js';
import type { GetUriProtocol } from './index.js';

/**
 * Returns a Readable stream from an "https:" URI.
 */
export const https: GetUriProtocol<HttpOptions> = (url, opts) => {
	return http(url, { ...opts, http: https_ });
};
