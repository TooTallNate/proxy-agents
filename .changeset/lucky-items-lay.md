---
'data-uri-to-buffer': major
---

Refactor to return an `ArrayBuffer` instead of a Node.js `Buffer`.

This change is being made to make the package platform-agnostic, and work in web browsers or other non-Node.js environments without polyfills.

For Node.js users of this package, you can get a Node.js `Buffer` instance from an `ArrayBuffer` like so:

```typescript
const uri = 'data:,Hello%2C%20World!';
const parsed = dataUriToBuffer(uri);
const buffer = Buffer.from(parsed.buffer);
// `buffer` is a Node.js Buffer
```
