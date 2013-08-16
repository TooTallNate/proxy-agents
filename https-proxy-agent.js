
/**
 * Module dependencies.
 */

var net = require('net');
var tls = require('tls');
var url = require('url');
var Agent = require('agent-base');
var inherits = require('util').inherits;

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
  Agent.call(this);

  var proxy = clone(opts, {});
  this.secureProxy = proxy.protocol && proxy.protocol == 'https:';
  this.secureEndpoint = opts.secureEndpoint !== false; // `true` by default
  if (!this.secureEndpoint) {
    this.defaultPort = 80;
  }

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
 * Default port to connect to.
 */

Agent.prototype.defaultPort = 443;

/**
 * Initiates a TCP connection to the specified HTTP proxy server.
 *
 * @api protected
 */

HttpsProxyAgent.prototype.createConnection = function (opts, fn) {
  var socket;
  if (this.secureProxy) {
    socket = tls.connect(this.proxy);
  } else {
    socket = net.connect(this.proxy);
  }

  function read () {
    var b = socket.read();
    if (b) ondata(b);
    else socket.once('readable', read);
  }

  var self = this;
  function ondata (b) {
    //console.log(b.length, b, b.toString());
    // TODO: verify that the socket is properly connected, check response...

    // since the proxy is connecting to an SSL server, we have
    // to upgrade this socket connection to an SSL connection
    var sock = socket;
    if (self.secureEndpoint) {
      sock = tls.connect({
        socket: socket,
        servername: opts.host
      });
    }

    fn(null, sock);
  }

  if (socket.read) {
    read();
  } else {
    socket.once('data', ondata);
  }

  var hostname = opts.host + ':' + opts.port;
  var msg = 'CONNECT ' + hostname + ' HTTP/1.1\r\n' +
    'Host: ' + hostname + '\r\n' +
    '\r\n';
  socket.write(msg);
};

function clone (src, dest) {
  for (var i in src) dest[i] = src[i];
  return dest;
}
