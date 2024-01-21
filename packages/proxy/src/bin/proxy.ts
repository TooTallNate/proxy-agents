#!/usr/bin/env node
import args from 'args';
import createDebug from 'debug';
import { spawn } from 'child_process';
import { once } from 'events';
// @ts-expect-error no types for "basic-auth-parser"
import basicAuthParser = require('basic-auth-parser');
import { createProxy } from '../proxy';
//import pkg from '../pkg';

const debug = createDebug('proxy');

process.title = 'proxy';

args.option(
	'port',
	'Port number to the proxy server should bind to',
	3128,
	parseInt
).option(
	'authenticate',
	'"authenticate" command to run when the "Proxy-Authorization" header is sent',
	'',
	String
);
//.option(
//	'local-address',
//	'IP address of the network interface to send the outgoing requests through',
//	'',
//	String
//);

const flags = args.parse(process.argv);
const { port, authenticate } = flags;

const proxy = createProxy();

/**
 * Outbound proxy requests will use `agent: false`.
 */

//debug("setting outbound proxy request's `agent` to `false`");
//proxy.agent = false;

/**
 * Proxy outgoing request localAddress parameter
 */

//if (flags.localAddress) {
//	proxy.localAddress = flags.localAddress;
//}

/**
 * Proxy authenticate function.
 */

if (authenticate) {
	debug('setting `authenticate()` function for: "%s"', authenticate);
	proxy.authenticate = async (req) => {
		debug('authenticate(): "%s"', authenticate);

		// parse the "Proxy-Authorization" header
		const auth = req.headers['proxy-authorization'];
		if (!auth) {
			// optimization: don't invoke the child process if no
			// "Proxy-Authorization" header was given
			return false;
		}
		const parsed = basicAuthParser(auth);
		debug('parsed "Proxy-Authorization": %j', parsed);

		// spawn a child process with the user-specified "authenticate" command
		const env = { ...process.env };
		// add "auth" related ENV variables
		for (const [key, value] of Object.entries(parsed)) {
			env['PROXY_AUTH_' + key.toUpperCase()] = value as string;
		}

		// TODO: add Windows support (use `cross-spawn`?)
		const child = spawn('/bin/sh', ['-c', authenticate], {
			env,
			stdio: ['ignore', 'inherit', 'inherit'],
		});

		const [code, signal]: number[] = await once(child, 'exit');
		debug('authentication child process "exit" event: %s %s', code, signal);
		return code === 0;
	};
}

proxy.listen(port, function () {
	console.log(
		'HTTP(s) proxy server listening on port %d',
		// @ts-expect-error "port" is a number
		proxy.address().port
	);
});
