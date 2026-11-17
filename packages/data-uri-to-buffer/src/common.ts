export interface ParsedDataURI {
	type: string;
	typeFull: string;
	charset: string;
	buffer: ArrayBuffer;
}

export interface IBufferConversions {
	base64ToArrayBuffer(base64: string): ArrayBuffer;
	stringToBuffer(str: string): ArrayBuffer;
}

/**
 * Returns a `Buffer` instance from the given data URI `uri`.
 *
 * @param {String} uri Data URI to turn into a Buffer instance
 */
export const makeDataUriToBuffer =
	(convert: IBufferConversions) =>
	(uri: string | URL): ParsedDataURI => {
		uri = String(uri);

		if (!/^data:/i.test(uri)) {
			throw new TypeError(
				'`uri` does not appear to be a Data URI (must begin with "data:")'
			);
		}

		// strip newlines
		uri = uri.replace(/\r?\n/g, '');

		// split the URI up into the "metadata" and the "data" portions
		const firstComma = uri.indexOf(',');
		if (firstComma === -1 || firstComma <= 4) {
			throw new TypeError('malformed data: URI');
		}

		// remove the "data:" scheme and parse the metadata
		const meta = uri.substring(5, firstComma).split(';');

		let charset = '';
		let base64 = false;
		const type = meta[0] || 'text/plain';
		let typeFull = type;
		for (let i = 1; i < meta.length; i++) {
			if (meta[i] === 'base64') {
				base64 = true;
			} else if (meta[i]) {
				typeFull += `;${meta[i]}`;
				if (meta[i].indexOf('charset=') === 0) {
					charset = meta[i].substring(8);
				}
			}
		}
		// defaults to US-ASCII only if type is not provided
		if (!meta[0] && !charset.length) {
			typeFull += ';charset=US-ASCII';
			charset = 'US-ASCII';
		}

		// Percent decoding operates on UTF-8 bytes, not UTF-16 code units.
		// Keep escaped bytes opaque, including bytes invalid in UTF-8.
		const data = uri
			.substring(firstComma + 1)
			.replace(/[\u0080-\uFFFF]+/g, (text) => {
				let bytes = '';
				for (const byte of new TextEncoder().encode(text)) {
					bytes += String.fromCharCode(byte);
				}
				return bytes;
			})
			.replace(/%([0-9a-f]{2})/gi, (_, hex: string) =>
				String.fromCharCode(parseInt(hex, 16))
			);
		const buffer = base64
			? convert.base64ToArrayBuffer(data)
			: convert.stringToBuffer(data);

		return {
			type,
			typeFull,
			charset,
			buffer,
		};
	};
