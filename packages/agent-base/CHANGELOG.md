# agent-base

## 7.1.1

### Patch Changes

- e62863c: Synchronously update internal sockets length so `http.Agent` pooling is used

## 7.1.0

### Minor Changes

- da699b1: Add `isSecureEndpoint()` as an instance method

## 7.0.2

### Patch Changes

- 66b4c63: Allow for never relying on stack trace

## 7.0.1

### Patch Changes

- 7674748: Update `@types/node` to v14.18.45

## 7.0.0

### Major Changes

- d99a7c8: Major version bump for all packages
  - ⚠️ This is a breaking change! In version 6.x, this package had a default export of a function that could be used to construct an
    `http.Agent`. Now this default export has been removed, instead there is a named export for the `Agent` abstract class. See the
    [README](README.md) for details on how to use the abstract class.

### Minor Changes

- 4333067: Add support for core `keepAlive: true`

### Patch Changes

- c169ced: Convert mocha tests to jest for all packages
