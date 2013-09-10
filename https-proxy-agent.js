
/**
 * Module dependencies.
 */

var net = require('net');
var tls = require('tls');
var url = require('url');
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

  var proxy = clone(opts, {});

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
 * Called when the node-core HTTP client library is creating a new HTTP request.
 *
 * @api public
 */

function connect (req, opts, fn) {

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

    var sock = socket;

    if (self.secureEndpoint) {
      // since the proxy is connecting to an SSL server, we have
      // to upgrade this socket connection to an SSL connection
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
  var msg = 'CONNECT ' + hostname + ' HTTP/1.1\r\n';
  var auth = this.proxy.auth;
  if (auth) {
    msg += 'Proxy-Authorization: Basic ' + new Buffer(auth).toString('base64') + '\r\n';
  }
  msg += 'Host: ' + hostname + '\r\n' +
    '\r\n';
  socket.write(msg);
};

function clone (src, dest) {
  for (var i in src) dest[i] = src[i];
  return dest;
}
