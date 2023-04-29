/**
 * Module dependencies.
 */

var isIP = require('net').isIP;
var assert = require('assert');
var { myIpAddress } = require('../').sandbox;

describe('myIpAddress()', function () {
	it('should return an IPv4 address', function (done) {
		myIpAddress().then((ip) => {
			assert.equal(4, isIP(ip));
			done();
		}, done);
	});
});
