proxy
=====
### An HTTP proxy written with Node.js (think Squid)
[![Build Status](https://github.com/TooTallNate/proxy/workflows/Node%20CI/badge.svg)](https://github.com/TooTallNate/proxy/actions?workflow=Node+CI)

This module provides standard "HTTP proxy" logic. You can script your own server
using the `proxy` server API. Be sure to take a look at the "Examples" section
below.

There is also a companion `proxy(1)` CLI tool, which spawns an HTTP(s) proxy
server with the specified options.

You could think of `proxy(1)` as similar to some of the other popular open
source HTTP proxy software:

 * [Squid][]
 * [Privoxy][]
 * [Apache][] with [`mod_proxy`][mod_proxy]
 * [More…](http://wikipedia.org/wiki/Proxy_server#Web_proxy_servers)


Installation
------------

Install with `npm`:

``` bash
$ npm install proxy
```

If you would like to have the `proxy(1)` CLI program in your `$PATH`, then
install "globally":

``` bash
$ npm install -g proxy
```


Examples
--------

#### Basic HTTP(s) proxy server

A basic HTTP(s) server with all the default options. All requests are allowed.
CONNECT HTTP method works as well.

``` js
var http = require('http');
var setup = require('proxy');

var server = setup(http.createServer());
server.listen(3128, function () {
  var port = server.address().port;
  console.log('HTTP(s) proxy server listening on port %d', port);
});
```


CLI Tool Examples
-----------------

The `proxy(1)` CLI tool can be used to spawn HTTP(s) proxy server instances with
various options.

#### Port to bind to

Pass the `-p`/`--port` option to with a port number to specify a TCP port to
bind to. Defaults to __3128__ if none is specified.

``` bash
$ proxy --port 8080
```

#### Custom `Proxy-Authenticate` command

Pass the `-a`/`--authenticate` switch with a command to execute when the client
`Proxy-Authorization` header is given. This command determines whether or not the
request is authorized based on the "exit code" of the command.

The relevant request authentication information is passed in as
`PROXY_AUTH_USERNAME`, `PROXY_AUTH_PASSWORD` and `PROXY_AUTH_SCHEME` environment
variables.

For example, to authorize "Basic" authentication with username "foo" and
password "bar":

``` bash
$ proxy --authenticate 'if \
    [ "$PROXY_AUTH_USERNAME" = "foo" ] && \
    [ "$PROXY_AUTH_PASSWORD" = "bar" ]; \
      then exit 0; \
    fi; \
    exit 1;'
```

#### Custom outgoing interface

Pass the `-l`/`--local-address` argument with an IP address of the network
interface to send the outgoing requests through. It is the equivalent of setting
a `localAddress` field in the options when calling `http.request()`.

``` bash
$ proxy --local-address 192.168.0.10
```

License
-------

(The MIT License)

Copyright (c) 2013 Nathan Rajlich &lt;nathan@tootallnate.net&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


[Squid]: http://www.squid-cache.org/
[Privoxy]: http://www.privoxy.org/
[Apache]: http://www.apache.org/
[mod_proxy]: http://httpd.apache.org/docs/current/mod/mod_proxy.html
