data-uri-to-buffer
==================
### Generate a Buffer instance from a [Data URI][rfc] string

This module accepts a ["data" URI][rfc] String of data, and returns a
node.js `Buffer` instance with the decoded data.

Example
-------

``` js
import { dataUriToBuffer } from 'data-uri-to-buffer';

// plain-text data is supported
let uri = 'data:,Hello%2C%20World!';
let decoded = dataUriToBuffer(uri);
console.log(decoded.toString());
// 'Hello, World!'

// base64-encoded data is supported
uri = 'data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D';
decoded = dataUriToBuffer(uri);
console.log(decoded.toString());
// 'Hello, World!'
```


API
---

### dataUriToBuffer(String uri) → Buffer

The `type` property on the Buffer instance gets set to the main type portion of
the "mediatype" portion of the "data" URI, or defaults to `"text/plain"` if not
specified.

The `typeFull` property on the Buffer instance gets set to the entire
"mediatype" portion of the "data" URI (including all parameters), or defaults
to `"text/plain;charset=US-ASCII"` if not specified.

The `charset` property on the Buffer instance gets set to the Charset portion of
the "mediatype" portion of the "data" URI, or defaults to `"US-ASCII"` if the
entire type is not specified, or defaults to `""` otherwise.

*Note*: If the only the main type is specified but not the charset, e.g.
`"data:text/plain,abc"`, the charset is set to the empty string. The spec only
defaults to US-ASCII as charset if the entire type is not specified.

[rfc]: http://tools.ietf.org/html/rfc2397
