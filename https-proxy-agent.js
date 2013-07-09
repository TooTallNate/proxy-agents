
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
  Agent.call(this);
  this.proxy = opts;
  this.secure = this.proxy.protocol && this.proxy.protocol == 'https:';
}
inherits(HttpsProxyAgent, Agent);

/**
 * Default port to connect to.
 */

Agent.prototype.defaultPort = 443;

/**
 * Initiates a TCP connection to the specified HTTP proxy server.
 *
 * @api public
 */

HttpsProxyAgent.prototype.createConnection = function (opts, fn) {
  var socket;
  var info = {
    host: this.proxy.hostname || this.proxy.host,
    port: +this.proxy.port || (this.secure ? 443 : 80)
  };
  if (this.secure) {
    socket = tls.connect(info);
  } else {
    socket = net.connect(info);
  }

  var msg = 'CONNECT ' + opts.host + ':' + opts.port + ' HTTP/1.1\r\n' +
    'Host: ' + opts.host + ':' + opts.port + '\r\n' +
    '\r\n';
  socket.write(msg);

  socket.ondata = function (b, offset, length) {
    var buf = b.slice(offset, length);
    // TODO: verify that the socket is properly connected, check response...

    socket.ondata = null;

    // since the proxy is connecting to an SSL server, we have
    // to upgrade this socket connection to an SSL connection
    socket = tls.connect({
      socket: socket,
      servername: opts.host
    });
    fn(null, socket);
  };
};
