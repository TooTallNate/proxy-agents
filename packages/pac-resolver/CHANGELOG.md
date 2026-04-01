# pac-resolver

## 9.0.0

### Major Changes

- 7d12b51: Set minimum Node.js version to 20

### Patch Changes

- 7ca27d0: Simplify package.json exports to remove unnecessary imports restriction
- Updated dependencies [7d12b51]
- Updated dependencies [7ca27d0]
  - degenerator@7.0.0

## 8.0.0

### Major Changes

- 9c92c09: Convert to ESM. All packages now use `"type": "module"` and compile to ESM output instead of CommonJS.

### Minor Changes

- b1509d8: Replace `@tootallnate/quickjs-emscripten` with `quickjs-wasi` for running sandboxed PAC file code. `quickjs-wasi` is a lighter-weight QuickJS WASM runtime built on quickjs-ng with WASI reactor mode. The `compile()` function now takes a `QuickJS` instance directly instead of `QuickJSWASMModule`, and `createPacResolver()` / `pac-proxy-agent` are updated accordingly.

### Patch Changes

- Updated dependencies [9c92c09]
- Updated dependencies [b1509d8]
  - degenerator@6.0.0

## 7.0.1

### Patch Changes

- a954da3: fix [GHSA-78xj-cgh5-2h22](https://github.com/advisories/GHSA-78xj-cgh5-2h22) vulnerability

## 7.0.0

### Major Changes

- f1f3220: Use `quickjs-emscripten` instead of `vm2` to execute PAC file code

### Patch Changes

- Updated dependencies [f1f3220]
  - degenerator@5.0.0

## 6.0.2

### Patch Changes

- 0fe8b72: Update dependencies
- Updated dependencies [7008a93]
  - degenerator@4.0.4

## 6.0.1

### Patch Changes

- 7674748: Update `@types/node` to v14.18.45
- Updated dependencies [7674748]
  - degenerator@4.0.1

## 6.0.0

### Major Changes

- d99a7c8: Major version bump for all packages

### Patch Changes

- c169ced: Convert mocha tests to jest for all packages
- Updated dependencies [c169ced]
- Updated dependencies [d99a7c8]
  - degenerator@4.0.0
