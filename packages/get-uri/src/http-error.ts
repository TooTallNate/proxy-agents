import { STATUS_CODES } from 'http';

/**
 * Error subclass to use when an HTTP application error has occurred.
 */
export default class HTTPError extends Error {
	public code: string;
	public statusCode: number;

	constructor(statusCode: number, message = STATUS_CODES[statusCode]) {
		super(message);
		this.statusCode = statusCode;
		this.code = `E${String(message).toUpperCase().replace(/\s+/g, '')}`;
	}
}
