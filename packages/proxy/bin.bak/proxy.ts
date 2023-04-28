#!/usr/bin/env node

process.title = 'proxy';

/**
 * Module dependencies.
 */

const args = require('args');
const pkg = require('../package');

args.option(
	'port',
	'Port number to the proxy server should bind to',
	3128,
	parseInt
)
	.option(
		'authenticate',
		'"authenticate" command to run when the "Proxy-Authorization" header is sent',
		'',
		String
	)
	.option(
		'local-address',
		'IP address of the network interface to send the outgoing requests through',
		'',
		String
	);

const flags = args.parse(process.argv, { name: pkg.name });
const { port, authenticate } = flags;

const http = require('http');
const setup = require('../');
const debug = require('debug')('proxy');
const spawn = require('child_process').spawn;
const basicAuthParser = require('basic-auth-parser');

/**
 * Setup the HTTP "proxy server" instance.
 */

const proxy = http.createServer();
setup(proxy);

/**
 * Outbound proxy requests will use `agent: false`.
 */

debug("setting outbound proxy request's `agent` to `false`");
proxy.agent = false;

/**
 * Proxy outgoing request localAddress parameter
 */

if (flags.localAddress) {
	proxy.localAddress = flags.localAddress;
}

/**
 * Proxy authenticate function.
 */

if (authenticate) {
	debug('setting `authenticate()` function for: "%s"', authenticate);
	proxy.authenticate = function(req, fn) {
		debug('authenticate(): "%s"', authenticate);

		// parse the "Proxy-Authorization" header
		var auth = req.headers['proxy-authorization'];
		if (!auth) {
			// optimization: don't invoke the child process if no
			// "Proxy-Authorization" header was given
			return fn(null, false);
		}
		var parsed = basicAuthParser(auth);
		debug('parsed "Proxy-Authorization": %j', parsed);

		// spawn a child process with the user-specified "authenticate" command
		var i;
		var env = {};
		for (i in process.env) {
			// inherit parent env variables
			env[i] = process.env[i];
		}
		// add "auth" related ENV variables
		for (i in parsed) {
			env['PROXY_AUTH_' + i.toUpperCase()] = parsed[i];
		}

		var opts = {};
		opts.stdio = ['ignore', 1, 2];
		opts.env = env;

		var args = ['-c', authenticate];
		// TODO: add Windows support (use `cross-spawn`?)
		var child = spawn('/bin/sh', args, opts);

		function onerror(err) {
			child.removeListener('exit', onexit);
			fn(err);
		}

		function onexit(code, signal) {
			debug(
				'authentication child process "exit" event: %s %s',
				code,
				signal
			);
			child.removeListener('error', onerror);
			fn(null, 0 == code);
		}

		child.once('error', onerror);
		child.once('exit', onexit);
	};
}

/**
 * Bind to port.
 */

proxy.listen(port, function() {
	console.log(
		'HTTP(s) proxy server listening on port %d',
		this.address().port
	);
});
