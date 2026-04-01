# degenerator

## 7.0.0

### Major Changes

- 7d12b51: Set minimum Node.js version to 20

### Patch Changes

- 7ca27d0: Simplify package.json exports to remove unnecessary imports restriction

## 6.0.0

### Major Changes

- 9c92c09: Convert to ESM. All packages now use `"type": "module"` and compile to ESM output instead of CommonJS.

### Minor Changes

- b1509d8: Replace `@tootallnate/quickjs-emscripten` with `quickjs-wasi` for running sandboxed PAC file code. `quickjs-wasi` is a lighter-weight QuickJS WASM runtime built on quickjs-ng with WASI reactor mode. The `compile()` function now takes a `QuickJS` instance directly instead of `QuickJSWASMModule`, and `createPacResolver()` / `pac-proxy-agent` are updated accordingly.

## 5.0.1

### Patch Changes

- a7d4fe5: Update escodegen dependency

## 5.0.0

### Major Changes

- f1f3220: Use `quickjs-emscripten` instead of `vm2` to execute PAC file code

## 4.0.4

### Patch Changes

- 7008a93: Update dependencies to fix ReDoS vulnerability

## 4.0.3

### Patch Changes

- 8e92eb8: Update `vm2` dependency to v3.9.19

## 4.0.2

### Patch Changes

- 9326064: Use `util.types.isRegExp()` to fix deprecation warning

## 4.0.1

### Patch Changes

- 7674748: Update `@types/node` to v14.18.45

## 4.0.0

### Major Changes

- d99a7c8: Major version bump for all packages

### Patch Changes

- c169ced: Convert mocha tests to jest for all packages
