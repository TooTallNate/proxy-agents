/* global describe, before, after, it */

const socks = require('socksv5')
const assert = require('assert')
const https = require('https')
const http = require('http')
const url = require('url')
const path = require('path')
const fs = require('fs')

const dns2 = require('dns2')
const CacheableLookup = require('cacheable-lookup')

const getRawBody = require('raw-body')
const { SocksProxyAgent } = require('..')

describe('SocksProxyAgent', function () {
  let httpServer
  let httpPort
  let httpsServer
  let httpsPort
  let socksServer
  let socksPort

  before(function (done) {
    // setup SOCKS proxy server
    socksServer = socks.createServer(function (info, accept, deny) {
      accept()
    })
    socksServer.listen(0, '127.0.0.1', function () {
      socksPort = socksServer.address().port
      done()
    })
    socksServer.useAuth(socks.auth.None())
  })

  before(function (done) {
    // setup target HTTP server
    httpServer = http.createServer()
    httpServer.listen(function () {
      httpPort = httpServer.address().port
      done()
    })
  })

  before(function (done) {
    // setup target SSL HTTPS server
    const options = {
      key: fs.readFileSync(path.resolve(__dirname, 'ssl-cert-snakeoil.key')),
      cert: fs.readFileSync(path.resolve(__dirname, 'ssl-cert-snakeoil.pem'))
    }
    httpsServer = https.createServer(options)
    httpsServer.listen(function () {
      httpsPort = httpsServer.address().port
      done()
    })
  })

  after(function (done) {
    socksServer.once('close', function () {
      done()
    })
    socksServer.close()
  })

  after(function (done) {
    httpServer.once('close', function () {
      done()
    })
    httpServer.close()
  })

  after(function (done) {
    httpsServer.once('close', function () {
      done()
    })
    httpsServer.close()
  })

  describe('constructor', function () {
    it('should throw an Error if no "proxy" argument is given', function () {
      assert.throws(() => new SocksProxyAgent())
    })
    it('should accept a "string" proxy argument', function () {
      const agent = new SocksProxyAgent(`socks://127.0.0.1:${socksPort}`)
      assert.equal('127.0.0.1', agent.proxy.host)
      assert.equal(socksPort, agent.proxy.port)
    })
    it('should accept a `new URL()` result object argument', function () {
      const opts = new URL(`socks://127.0.0.1:${socksPort}`)
      const agent = new SocksProxyAgent(opts)
      assert.equal('127.0.0.1', agent.proxy.host)
      assert.equal(socksPort, agent.proxy.port)
    })
    it('setup timeout', function (done) {
      httpServer.once('request', function (req, res) {
        assert.equal('/timeout', req.url)
        res.statusCode = 200
        setTimeout(() => res.end('Written after 1000'), 500)
      })

      const agent = new SocksProxyAgent(`socks://127.0.0.1:${socksPort}`, { timeout: 50 })

      const opts = {
        protocol: 'http:',
        host: `127.0.0.1:${httpPort}`,
        port: httpPort,
        hostname: '127.0.0.1',
        path: '/timeout',
        agent,
        headers: { foo: 'bar' }
      }

      const req = http.get(opts, function () {})

      req.once('error', err => {
        assert.equal(err.message, 'socket hang up')
        done()
      })
    })
  })

  describe('"http" module', function () {
    it('should work against an HTTP endpoint', function (done) {
      httpServer.once('request', function (req, res) {
        assert.equal('/foo', req.url)
        res.statusCode = 404
        res.end(JSON.stringify(req.headers))
      })

      const agent = new SocksProxyAgent(`socks://127.0.0.1:${socksPort}`)

      const opts = {
        protocol: 'http:',
        host: `127.0.0.1:${httpPort}`,
        port: httpPort,
        hostname: '127.0.0.1',
        path: '/foo',
        agent,
        headers: { foo: 'bar' }
      }
      const req = http.get(opts, function (res) {
        assert.equal(404, res.statusCode)
        getRawBody(res, 'utf8', function (err, buf) {
          if (err) return done(err)
          const data = JSON.parse(buf)
          assert.equal('bar', data.foo)
          done()
        })
      })
      req.once('error', done)
    })
  })

  describe('"https" module', function () {
    it('should work against an HTTPS endpoint', function (done) {
      httpsServer.once('request', function (req, res) {
        assert.equal('/foo', req.url)
        res.statusCode = 404
        res.end(JSON.stringify(req.headers))
      })

      const agent = new SocksProxyAgent(`socks://127.0.0.1:${socksPort}`)

      const opts = {
        protocol: 'https:',
        host: `127.0.0.1:${httpsPort}`,
        port: httpsPort,
        hostname: '127.0.0.1',
        path: '/foo',
        agent,
        rejectUnauthorized: false,
        headers: { foo: 'bar' }
      }

      const req = https.get(opts, function (res) {
        assert.equal(404, res.statusCode)
        getRawBody(res, 'utf8', function (err, buf) {
          if (err) return done(err)
          const data = JSON.parse(buf)
          assert.equal('bar', data.foo)
          done()
        })
      })
      req.once('error', done)
    })
  })

  describe('Custom lookup option', function () {

    let dnsServer
    let dnsQueries

    before((done) => {
      dnsQueries = []

      // A custom DNS server that always replies with 127.0.0.1:
      dnsServer = dns2.createServer({
        udp: true,
        handle: (request, send) => {
          const response = dns2.Packet.createResponseFromRequest(request)
          const [ question ] = request.questions
          const { name } = question

          dnsQueries.push({ type: question.type, name: question.name })

          response.answers.push({
            name,
            type: dns2.Packet.TYPE.A,
            class: dns2.Packet.CLASS.IN,
            ttl: 300,
            address: '127.0.0.1'
          })
          send(response)
        }
      })
      dnsServer.listen({ udp: 5333 })
      dnsServer.on('listening', () => done())
    })

    after(() => {
      dnsServer.close()
    })

    it("should use a requests's custom lookup function with socks5", function(done) {
      httpServer.once('request', function(req, res) {
        assert.equal('/foo', req.url)
        res.statusCode = 404
        res.end()
      })

      let agent = new SocksProxyAgent(`socks5://127.0.0.1:${socksPort}`)
      let opts = url.parse(`http://non-existent-domain.test:${httpPort}/foo`)
      opts.agent = agent

      opts.lookup = (hostname, opts, callback) => {
        if (hostname === 'non-existent-domain.test') callback(null, '127.0.0.1')
        else callback(new Error("Bad domain"))
      }

      let req = http.get(opts, function(res) {
        assert.equal(404, res.statusCode)
        getRawBody(res, 'utf8', function(err, buf) {
          if (err) return done(err)
          done()
        })
      })
      req.once('error', done)
    })

    it("should support caching DNS requests", function(done) {
      httpServer.on('request', function(req, res) {
        res.statusCode = 200
        res.end()
      })

      let agent = new SocksProxyAgent(`socks5://127.0.0.1:${socksPort}`)
      let opts = url.parse(`http://test-domain.test:${httpPort}/foo`)
      opts.agent = agent

      const cacheableLookup = new CacheableLookup()
      cacheableLookup.servers = ['127.0.0.1:5333']
      opts.lookup = cacheableLookup.lookup

      // No DNS queries made initially
      assert.deepEqual(dnsQueries, [])

      http.get(opts, function(res) {
        assert.equal(200, res.statusCode)

        // Initial DNS query for first request
        assert.deepEqual(dnsQueries, [
          { name: 'test-domain.test', type: dns2.Packet.TYPE.A },
          { name: 'test-domain.test', type: dns2.Packet.TYPE.AAAA }
        ])

        http.get(opts, function(res) {
          assert.equal(200, res.statusCode)

          // Still the same. No new DNS queries, so the response was cached
          assert.deepEqual(dnsQueries, [
            { name: 'test-domain.test', type: dns2.Packet.TYPE.A },
            { name: 'test-domain.test', type: dns2.Packet.TYPE.AAAA }
          ])
          done()
        }).once('error', done)
      }).once('error', done)
    })
  })
})
