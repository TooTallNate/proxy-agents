
/**
 * Module dependencies.
 */

var fs = require('fs');
var url = require('url');
var http = require('http');
var https = require('https');
var assert = require('assert');
var Proxy = require('proxy');
var HttpsProxyAgent = require('../');

describe('HttpsProxyAgent', function () {

  var server;
  var serverPort;

  var sslServer;
  var sslServerPort;

  var proxy;
  var proxyPort;

  var sslProxy;
  var sslProxyPort;

  before(function (done) {
    // setup target HTTP server
    server = http.createServer();
    server.listen(function () {
      serverPort = server.address().port;
      done();
    });
  });

  before(function (done) {
    // setup HTTP proxy server
    proxy = Proxy();
    proxy.listen(function () {
      proxyPort = proxy.address().port;
      done();
    });
  });

  before(function (done) {
    // setup target HTTPS server
    var options = {
      key: fs.readFileSync(__dirname + '/server.key'),
      cert: fs.readFileSync(__dirname + '/server.crt')
    };
    sslServer = https.createServer(options);
    sslServer.listen(function () {
      sslServerPort = sslServer.address().port;
      done();
    });
  });

  before(function (done) {
    // setup SSL HTTP proxy server
    var options = {
      key: fs.readFileSync(__dirname + '/server.key'),
      cert: fs.readFileSync(__dirname + '/server.crt')
    };
    sslProxy = Proxy(https.createServer(options));
    sslProxy.listen(function () {
      sslProxyPort = sslProxy.address().port;
      done();
    });
  });

  // shut down test HTTP server
  after(function (done) {
    server.once('close', function () { done(); });
    server.close();
  });

  after(function (done) {
    proxy.once('close', function () { done(); });
    proxy.close();
  });

  after(function (done) {
    sslServer.once('close', function () { done(); });
    sslServer.close();
  });

  after(function (done) {
    sslProxy.once('close', function () { done(); });
    sslProxy.close();
  });

  describe('constructor', function () {
    it('should throw an Error if no "proxy" argument is given', function () {
      assert.throws(function () {
        new HttpsProxyAgent();
      });
    });
    it('should accept a "string" proxy argument', function () {
      var agent = new HttpsProxyAgent('http://127.0.0.1:' + proxyPort);
      assert.equal('127.0.0.1', agent.proxy.host);
      assert.equal(proxyPort, agent.proxy.port);
    });
    it('should accept a `url.parse()` result object argument', function () {
      var opts = url.parse('http://127.0.0.1:' + proxyPort);
      var agent = new HttpsProxyAgent(opts);
      assert.equal('127.0.0.1', agent.proxy.host);
      assert.equal(proxyPort, agent.proxy.port);
    });
  });

  describe('"https" module', function () {
    it('should work over an HTTP proxy', function (done) {
      // set HTTP "request" event handler for this test
      sslServer.once('request', function (req, res) {
        res.end(JSON.stringify(req.headers));
      });

      var proxy = process.env.HTTP_PROXY || process.env.http_proxy || 'http://127.0.0.1:' + proxyPort;
      proxy = url.parse(proxy);
      // `rejectUnauthorized` shoudn't *technically* be necessary here,
      // but up until node v0.11.6, the `http.Agent` class didn't have
      // access to the *entire* request "options" object. Thus,
      // `https-proxy-agent` will *also* merge in options you pass here
      // to the destination endpoints…
      proxy.rejectUnauthorized = false;
      var agent = new HttpsProxyAgent(proxy);

      var opts = url.parse('https://127.0.0.1:' + sslServerPort);
      opts.rejectUnauthorized = false;
      opts.agent = agent;

      https.get(opts, function (res) {
        var data = '';
        res.setEncoding('utf8');
        res.on('data', function (b) {
          data += b;
        });
        res.on('end', function () {
          data = JSON.parse(data);
          assert.equal('127.0.0.1:' + sslServerPort, data.host);
          done();
        });
      });
    });
    it('should work over an HTTPS proxy', function (done) {
      // set HTTP "request" event handler for this test
      sslServer.once('request', function (req, res) {
        res.end(JSON.stringify(req.headers));
      });

      var proxy = process.env.HTTPS_PROXY || process.env.https_proxy || 'https://127.0.0.1:' + sslProxyPort;
      proxy = url.parse(proxy);
      // `rejectUnauthorized` is actually necessary this time since the HTTPS
      // proxy server itself is using a self-signed SSL certificate…
      proxy.rejectUnauthorized = false;
      var agent = new HttpsProxyAgent(proxy);

      var opts = url.parse('https://127.0.0.1:' + sslServerPort);
      opts.agent = agent;
      opts.rejectUnauthorized = false;

      https.get(opts, function (res) {
        var data = '';
        res.setEncoding('utf8');
        res.on('data', function (b) {
          data += b;
        });
        res.on('end', function () {
          data = JSON.parse(data);
          assert.equal('127.0.0.1:' + sslServerPort, data.host);
          done();
        });
      });
    });
  });

});
