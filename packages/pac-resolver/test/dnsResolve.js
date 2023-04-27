/**
 * Module dependencies.
 */

var isIP = require('net').isIP;
var assert = require('assert');
var { dnsResolve } = require('../').sandbox;

describe('dnsResolve(host)', function () {
	var tests = [
		['www.netscape.com', true],
		['bogus.domain.foobar', false],
	];

	tests.forEach(function (test) {
		var expected = test.pop();
		if (expected) {
			it(
				'should resolve an IPv4 address for "' +
					test.join('", "') +
					'"',
				function (done) {
					dnsResolve(test[0]).then((res) => {
						assert.equal('string', typeof res);
						assert.equal(4, isIP(res));
						done();
					}, done);
				}
			);
		} else {
			it(
				'should return null for if can\'t be resolved "' +
					test.join('", "') +
					'"',
				function (done) {
					dnsResolve(test[0]).then((res) => {
						assert.equal(null, res);
						done();
					}, done);
				}
			);
		}
	});
});
