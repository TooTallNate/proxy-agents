import createDebug from 'debug';
import { IncomingHttpHeaders } from 'http';
import { Readable } from 'stream';

const debug = createDebug('https-proxy-agent:parse-proxy-response');

export interface ConnectResponse {
	statusCode: number;
	statusText: string;
	headers: IncomingHttpHeaders;
}

export function parseProxyResponse(
	socket: Readable
): Promise<{ connect: ConnectResponse; buffered: Buffer }> {
	return new Promise((resolve, reject) => {
		// we need to buffer any HTTP traffic that happens with the proxy before we get
		// the CONNECT response, so that if the response is anything other than an "200"
		// response code, then we can re-play the "data" events on the socket once the
		// HTTP parser is hooked up...
		let buffersLength = 0;
		const buffers: Buffer[] = [];
		let connect: ConnectResponse | undefined;
		let bodyStart = 0;

		function read() {
			const b = socket.read();
			if (b) ondata(b);
			else socket.once('readable', read);
		}

		function cleanup() {
			socket.removeListener('end', onend);
			socket.removeListener('error', onerror);
			socket.removeListener('readable', read);
		}

		function onend() {
			cleanup();
			debug('onend');
			if (connect) {
				// The proxy closed the connection before sending the whole
				// body. Replay whatever was received.
				resolve({
					connect,
					buffered: Buffer.concat(buffers, buffersLength),
				});
				return;
			}
			reject(
				new Error(
					'Proxy connection ended before receiving CONNECT response'
				)
			);
		}

		function onerror(err: Error) {
			cleanup();
			debug('onerror %o', err);
			if (connect) {
				// The headers already arrived, so replay what was received.
				resolve({
					connect,
					buffered: Buffer.concat(buffers, buffersLength),
				});
				return;
			}
			reject(err);
		}

		function ondata(b: Buffer) {
			buffers.push(b);
			buffersLength += b.length;

			const buffered = Buffer.concat(buffers, buffersLength);
			if (connect) {
				onbody(connect, buffered);
				return;
			}

			const endOfHeaders = buffered.indexOf('\r\n\r\n');

			if (endOfHeaders === -1) {
				// keep buffering
				debug('have not received end of HTTP headers yet...');
				read();
				return;
			}

			const headerParts = buffered
				.slice(0, endOfHeaders)
				.toString('ascii')
				.split('\r\n');
			const firstLine = headerParts.shift();
			if (!firstLine) {
				socket.destroy();
				return reject(
					new Error('No header received from proxy CONNECT response')
				);
			}
			const firstLineParts = firstLine.split(' ');
			const statusCode = +firstLineParts[1];
			const statusText = firstLineParts.slice(2).join(' ');
			const headers: IncomingHttpHeaders = {};
			for (const header of headerParts) {
				if (!header) continue;
				const firstColon = header.indexOf(':');
				if (firstColon === -1) {
					socket.destroy();
					return reject(
						new Error(
							`Invalid header from proxy CONNECT response: "${header}"`
						)
					);
				}
				const key = header.slice(0, firstColon).toLowerCase();
				const value = header.slice(firstColon + 1).trimStart();
				const current = headers[key];
				if (typeof current === 'string') {
					headers[key] = [current, value];
				} else if (Array.isArray(current)) {
					current.push(value);
				} else {
					headers[key] = value;
				}
			}
			debug('got proxy server response: %o %o', firstLine, headers);
			connect = {
				statusCode,
				statusText,
				headers,
			};
			bodyStart = endOfHeaders + 4;
			onbody(connect, buffered);
		}

		function onbody(response: ConnectResponse, buffered: Buffer) {
			// A non-200 response is replayed to the HTTP client after the
			// proxy socket is closed, so wait for its whole body first, or
			// the client sees the response end early. A 200 response has no
			// body: the bytes after its headers belong to the tunnel.
			const bodyLength = getExpectedBodyLength(response);
			if (
				response.statusCode !== 200 &&
				buffered.length - bodyStart < bodyLength
			) {
				debug('have not received the whole proxy response body yet...');
				read();
				return;
			}
			cleanup();
			resolve({ connect: response, buffered });
		}

		socket.on('error', onerror);
		socket.on('end', onend);

		read();
	});
}

// Largest response body to wait for before replaying what was received.
const MAX_BODY_LENGTH = 64 * 1024;

function getExpectedBodyLength({ headers }: ConnectResponse): number {
	const contentLength = Number(headers['content-length']);
	if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
		return 0;
	}
	return Math.min(contentLength, MAX_BODY_LENGTH);
}
