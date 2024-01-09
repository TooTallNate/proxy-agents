import { makeDataUriToBuffer } from './common';

export type { ParsedDataURI } from  './common';

function nodeBuffertoArrayBuffer(nodeBuf: Buffer) {
	if (nodeBuf.byteLength === nodeBuf.buffer.byteLength) {
		return nodeBuf.buffer; // large strings may get their own memory allocation
	}
	const buffer = new ArrayBuffer(nodeBuf.byteLength);
	const view = new Uint8Array(buffer);
	view.set(nodeBuf);
	return buffer;
}

function base64ToArrayBuffer(base64: string) {
	return nodeBuffertoArrayBuffer(Buffer.from(base64, 'base64'));
}

function stringToBuffer(str: string): ArrayBuffer {
	return nodeBuffertoArrayBuffer(Buffer.from(str, 'ascii'));
}

/**
 * Returns a `Buffer` instance from the given data URI `uri`.
 *
 * @param {String} uri Data URI to turn into a Buffer instance
 */
export const dataUriToBuffer = makeDataUriToBuffer({ stringToBuffer, base64ToArrayBuffer });
