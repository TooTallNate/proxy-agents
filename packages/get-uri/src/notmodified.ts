/**
 * Error subclass to use when the source has not been modified.
 *
 * @param {String} message optional "message" property to set
 * @api protected
 */
export default class NotModifiedError extends Error {
	public code = 'ENOTMODIFIED';

	constructor(message?: string) {
		super(
			message ||
				'Source has not been modified since the provied "cache", re-use previous results'
		);
	}
}
