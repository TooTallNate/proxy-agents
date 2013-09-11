
/**
 * Module dependencies.
 */

var net = require('net');
var tls = require('tls');
var url = require('url');
var extend = require('extend');
var Agent = require('agent-base');
var inherits = require('util').inherits;
var debug = require('debug')('https-proxy-agent');

/**
 * Module exports.
 */

module.exports = HttpsProxyAgent;

/**
 * The `HttpsProxyAgent` implements an HTTP Agent subclass that connects to the
 * specified "HTTP(s) proxy server" in order to proxy HTTPS requests.
 *
 * @api public
 */

function HttpsProxyAgent (opts) {
  if (!(this instanceof HttpsProxyAgent)) return new HttpsProxyAgent(opts);
  if ('string' == typeof opts) opts = url.parse(opts);
  if (!opts) throw new Error('an HTTP(S) proxy server `host` and `port` must be specified!');
  debug('creating new HttpsProxyAgent instance: %j', opts);
  Agent.call(this, connect);

  var proxy = extend({}, opts);

  // if `true`, then connect to the proxy server over TLS. defaults to `false`.
  this.secureProxy = proxy.protocol ? proxy.protocol == 'https:' : false;

  // if `true`, then connect to the destination endpoint over TLS, defaults to `true`
  this.secureEndpoint = opts.secureEndpoint !== false;

  // prefer `hostname` over `host`, and set the `port` if needed
  proxy.host = proxy.hostname || proxy.host;
  proxy.port = +proxy.port || (this.secureProxy ? 443 : 80);

  if (proxy.host && proxy.path) {
    // if both a `host` and `path` are specified then it's most likely the
    // result of a `url.parse()` call... we need to remove the `path` portion so
    // that `net.connect()` doesn't attempt to open that as a unix socket file.
    delete proxy.path;
  }

  this.proxy = proxy;
}
inherits(HttpsProxyAgent, Agent);

/**
 * Default options for the "connect" opts object.
 */

var defaults = { port: 80 };
var secureDefaults = { port: 443 };

/**
 * Called when the node-core HTTP client library is creating a new HTTP request.
 *
 * @api public
 */

function connect (req, _opts, fn) {

  var proxy = this.proxy;
  var secureProxy = this.secureProxy;
  var secureEndpoint = this.secureEndpoint;

  // these `opts` are the connect options to connect to the destination endpoint
  var opts = extend({}, proxy, secureEndpoint ? secureDefaults : defaults, _opts);

  var socket;
  if (secureProxy) {
    socket = tls.connect(proxy);
  } else {
    socket = net.connect(proxy);
  }

  function read () {
    var b = socket.read();
    if (b) ondata(b);
    else socket.once('readable', read);
  }

  function cleanup () {
    socket.removeListener('data', ondata);
    socket.removeListener('error', onerror);
    socket.removeListener('readable', read);
  }

  function onerror (err) {
    cleanup();
    fn(err);
  }

  function ondata (b) {
    //console.log(b.length, b, b.toString());
    // TODO: verify that the socket is properly connected, check response...

    var sock = socket;

    if (secureEndpoint) {
      // since the proxy is connecting to an SSL server, we have
      // to upgrade this socket connection to an SSL connection
      opts.socket = socket;
      opts.servername = opts.host;
      opts.host = null;
      opts.hostname = null;
      opts.port = null;
      sock = tls.connect(opts);
    }

    cleanup();
    fn(null, sock);
  }

  socket.on('error', onerror);

  if (socket.read) {
    read();
  } else {
    socket.once('data', ondata);
  }

  var hostname = opts.host + ':' + opts.port;
  var msg = 'CONNECT ' + hostname + ' HTTP/1.1\r\n';
  var auth = proxy.auth;
  if (auth) {
    msg += 'Proxy-Authorization: Basic ' + new Buffer(auth).toString('base64') + '\r\n';
  }
  msg += 'Host: ' + hostname + '\r\n' +
    '\r\n';
  socket.write(msg);
};
