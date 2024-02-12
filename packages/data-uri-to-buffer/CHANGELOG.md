# data-uri-to-buffer

## 6.0.2

### Patch Changes

- c881a18: Use native Buffer decoding in Node.js

## 6.0.1

### Patch Changes

- 1d146e8: Ensure `<reference types="node" />` is not present in generated types

## 6.0.0

### Major Changes

- 52b458f: Refactor to return an `ArrayBuffer` instead of a Node.js `Buffer`.

  This change is being made to make the package platform-agnostic, and work in web browsers or other non-Node.js environments without polyfills.

  For Node.js users of this package, you can get a Node.js `Buffer` instance from an `ArrayBuffer` like so:

  ```typescript
  const uri = 'data:,Hello%2C%20World!';
  const parsed = dataUriToBuffer(uri);
  const buffer = Buffer.from(parsed.buffer);
  // `buffer` is a Node.js Buffer
  ```

## 5.0.1

### Patch Changes

- 7674748: Update `@types/node` to v14.18.45

## 5.0.0

### Major Changes

- d99a7c8: Major version bump for all packages

### Patch Changes

- c169ced: Convert mocha tests to jest for all packages
