/**
 * Error subclass to use when the source does not exist at the specified endpoint.
 *
 * @param {String} message optional "message" property to set
 * @api protected
 */

export default class NotFoundError extends Error {
	public code = 'ENOTFOUND';

	constructor(message?: string) {
		super(message || 'File does not exist at the specified endpoint');
	}
}
