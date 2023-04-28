import fs from 'fs';
import http from 'http';
import https from 'https';
import assert from 'assert';
import { json, req, toBuffer } from 'agent-base';
import { ProxyServer, createProxy } from 'proxy';
// @ts-expect-error no types
import socks from 'socksv5';
import { listen } from 'async-listen';
import { ProxyAgent } from '../src';

const sslOptions = {
  key: fs.readFileSync(__dirname + '/ssl-cert-snakeoil.key'),
  cert: fs.readFileSync(__dirname + '/ssl-cert-snakeoil.pem')
};

describe('ProxyAgent', () => {
  // target servers
  let httpServer: http.Server;
  let httpServerUrl: URL;
  let httpsServer: https.Server;
  let httpsServerUrl: URL;

  // proxy servers
  let httpProxyServer: ProxyServer;
  let httpProxyServerUrl: URL;
  let httpsProxyServer: ProxyServer;
  let httpsProxyServerUrl: URL;
  let socksServer: any;
  let socksPort: number;

  beforeAll(async () => {
    // setup target HTTP server
    httpServer = http.createServer();
    httpServerUrl = await listen(httpServer) as URL;
  });

  beforeAll(async () => {
    // setup target SSL HTTPS server
    httpsServer = https.createServer(sslOptions);
    httpsServerUrl = await listen(httpsServer) as URL;
  });

  beforeAll(async () => {
    // setup SOCKS proxy server
    // @ts-expect-error no types
    socksServer = socks.createServer((_info, accept) => {
      accept();
    });
    socksServer.useAuth(socks.auth.None());
    await listen(socksServer);
    socksPort = socksServer.address().port;
  });

  beforeAll(async () => {
    // setup HTTP proxy server
    httpProxyServer = createProxy();
    httpProxyServerUrl = await listen(httpProxyServer) as URL;
  });

  beforeAll(async () => {
    // setup SSL HTTPS proxy server
    httpsProxyServer = createProxy(https.createServer(sslOptions));
    httpsProxyServerUrl = await listen(httpsProxyServer) as URL;
  });

  afterAll(() => {
    socksServer.close();
    httpServer.close();
    httpsServer.close();
    httpProxyServer.close();
    httpsProxyServer.close();
  });

  describe('"http" module', () => {
		it('should work over "http" proxy', async () => {
			httpServer.once("request", function (req, res) {
				res.end(JSON.stringify(req.headers));
			});

			process.env.HTTP_PROXY = httpProxyServerUrl.href;
			const agent = new ProxyAgent();

			const res = await req(new URL("/test", httpServerUrl), { agent });
			const body = await json(res);
			assert.equal(httpServerUrl.host, body.host);
			assert("via" in body);
		});

		it("should work with no proxy from env", async () => {
			httpServer.once("request", function (req, res) {
				res.end(JSON.stringify(req.headers));
			});

			process.env.NO_PROXY = "*";
			const agent = new ProxyAgent();

			const res = await req(new URL("/test", httpServerUrl), { agent });
			const body = await json(res);
			assert.equal(httpServerUrl.host, body.host);
			assert(!("via" in body));
		});

		//describe('over "https" proxy', () => {
		//  it('should work', async () => {
		//    httpServer.once('request', function (req, res) {
		//      res.end(JSON.stringify(req.headers));
		//    });

		//    const uri = 'https://localhost:' + proxyHttpsPort;
		//    const proxy = url.parse(uri);
		//    // TODO
		//    //proxy.rejectUnauthorized = false;
		//    const agent = new ProxyAgent();

		//    const opts = url.parse('http://localhost:' + httpPort + '/test');
		//    opts.agent = agent;

		//    const req = http.get(opts, function (res) {
		//      toBuffer(res, function (err, buf) {
		//        if (err) return done(err);
		//        const data = JSON.parse(buf.toString('utf8'));
		//        assert.equal('localhost:' + httpPort, data.host);
		//        assert('via' in data);
		//        done();
		//      });
		//    });
		//    req.once('error', done);
		//  });
		//});

		//describe('over "socks" proxy', () => {
		//  it('should work', async () => {
		//    httpServer.once('request', function (req, res) {
		//      res.end(JSON.stringify(req.headers));
		//    });

		//    const uri = 'socks://localhost:' + socksPort;
		//    const agent = new ProxyAgent(uri);

		//    const opts = url.parse('http://localhost:' + httpPort + '/test');
		//    opts.agent = agent;

		//    const req = http.get(opts, function (res) {
		//      toBuffer(res, function (err, buf) {
		//        if (err) return done(err);
		//        const data = JSON.parse(buf.toString('utf8'));
		//        assert.equal('localhost:' + httpPort, data.host);
		//        done();
		//      });
		//    });
		//    req.once('error', done);
		//  });
		//});
  });

  //describe('"https" module', () => {
  //  describe('over "http" proxy', () => {
  //    it('should work', async () => {
  //      httpsServer.once('request', function (req, res) {
  //        res.end(JSON.stringify(req.headers));
  //      });

  //      const uri = 'http://localhost:' + proxyPort;
  //      const agent = new ProxyAgent(uri);

  //      const opts = url.parse('https://localhost:' + httpsPort + '/test');
  //      opts.agent = agent;
  //      opts.rejectUnauthorized = false;

  //      const req = https.get(opts, function (res) {
  //        toBuffer(res, function (err, buf) {
  //          if (err) return done(err);
  //          const data = JSON.parse(buf.toString('utf8'));
  //          assert.equal('localhost:' + httpsPort, data.host);
  //          done();
  //        });
  //      });
  //      req.once('error', done);
  //    });
  //  });

  //  describe('over "https" proxy', () => {
  //    it('should work', async () => {
  //      let gotReq = false;
  //      httpsServer.once('request', function (req, res) {
  //        gotReq = true;
  //        res.end(JSON.stringify(req.headers));
  //      });

  //      const agent = new ProxyAgent({
  //        protocol: 'https:',
  //        host: 'localhost',
  //        port: proxyHttpsPort,
  //        rejectUnauthorized: false
  //      });

  //      const opts = url.parse('https://localhost:' + httpsPort + '/test');
  //      opts.agent = agent;
  //      opts.rejectUnauthorized = false;

  //      const req = https.get(opts, function (res) {
  //        toBuffer(res, function (err, buf) {
  //          if (err) return done(err);
  //          const data = JSON.parse(buf.toString('utf8'));
  //          assert.equal('localhost:' + httpsPort, data.host);
  //          assert(gotReq);
  //          done();
  //        });
  //      });
  //      req.once('error', done);
  //    });
  //  });

  //  describe('over "socks" proxy', () => {
  //    it('should work', async () => {
  //      let gotReq = false;
  //      httpsServer.once('request', function (req, res) {
  //        gotReq = true;
  //        res.end(JSON.stringify(req.headers));
  //      });

  //      const uri = 'socks://localhost:' + socksPort;
  //      const agent = new ProxyAgent(uri);

  //      const opts = url.parse('https://localhost:' + httpsPort + '/test');
  //      opts.agent = agent;
  //      opts.rejectUnauthorized = false;

  //      const req = https.get(opts, function (res) {
  //        toBuffer(res, function (err, buf) {
  //          if (err) return done(err);
  //          const data = JSON.parse(buf.toString('utf8'));
  //          assert.equal('localhost:' + httpsPort, data.host);
  //          assert(gotReq);
  //          done();
  //        });
  //      });
  //      req.once('error', done);
  //    });
  //  });
  //});
});
