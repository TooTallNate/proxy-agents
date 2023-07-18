import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { degenerator, compile } from '../src';
import { getQuickJS, type QuickJSWASMModule } from '@tootallnate/quickjs-emscripten';

describe('degenerator()', () => {
	it('should support "async" output functions', () => {
		function aPlusB(a: () => string, b: () => string): string {
			return a() + b();
		}
		const compiled = degenerator('' + aPlusB, ['a']);
		assert.equal(
			compiled.replace(/\s+/g, ' '),
			'async function aPlusB(a, b) { return await a() + b(); }'
		);
	});
	it('should be the default "output" mode (without options)', () => {
		function foo(a: () => string): string {
			return a();
		}
		const compiled = degenerator('' + foo, ['a']);
		assert.equal(
			compiled.replace(/\s+/g, ' '),
			'async function foo(a) { return await a(); }'
		);
	});

	describe('"expected" fixture tests', () => {
		fs.readdirSync(__dirname)
			.sort()
			.forEach((n) => {
				if (n === 'tsconfig.json') return;
				if (/\.expected\.js$/.test(n)) return;
				if (/\.ts$/.test(n)) return;
				if (/\.map/.test(n)) return;

				const expectedName = `${path.basename(n, '.js')}.expected.js`;

				it(`${n} → ${expectedName}`, function () {
					const sourceName = path.resolve(__dirname, n);
					const compiledName = path.resolve(__dirname, expectedName);
					const js = fs.readFileSync(sourceName, 'utf8');
					const expected = fs.readFileSync(compiledName, 'utf8');

					// the test case can define the `names` to use as a
					// comment on the first line of the file
					const m = js.match(/\/\/\s*(.*)/);
					let names;
					if (m) {
						// the comment should be a comma-separated list of function names
						names = m[1].split(/,\s*/);
					} else {
						// if no function names were passed in then convert them all
						names = [/.*/];
					}

					const compiled = degenerator(js, names);
					assert.equal(
						compiled.trim().replace(/\r/g, ''),
						expected.trim().replace(/\r/g, '')
					);
				});
			});
	});

	describe('`compile()`', () => {
		let qjs: QuickJSWASMModule;

		beforeAll(async () => {
			qjs = await getQuickJS();
		});

		it('should compile code into an invocable async function', async () => {
			const a = (v: string) => Promise.resolve(v);
			const b = () => 'b';
			function aPlusB(v: string): string {
				return a(v) + b();
			}
			const fn = compile<string, [string]>(qjs, '' + aPlusB, 'aPlusB', {
				names: ['a'],
				sandbox: { a, b },
			});
			const val = await fn('c');
			assert.equal(val, 'cb');
		});
		it('should contain the compiled code in `toString()` output', async () => {
			const a = () => 'a';
			const b = () => 'b';
			function aPlusB(): string {
				return a() + b();
			}
			const fn = compile<string>(qjs, '' + aPlusB, 'aPlusB', {
				names: ['b'],
				sandbox: { a, b },
			});
			assert(/await b\(\)/.test(fn + ''));
		});
		it('should be able to await non-promises', async () => {
			const a = () => 'a';
			const b = () => 'b';
			function aPlusB(): string {
				return a() + b();
			}
			const fn = compile<string>(qjs, '' + aPlusB, 'aPlusB', {
				names: ['a'],
				sandbox: { a, b },
			});
			const val = await fn();
			assert.equal(val, 'ab');
		});
		it('should be able to compile functions with no async', async () => {
			const a = () => 'a';
			const b = () => 'b';
			function aPlusB(): string {
				return a() + b();
			}
			const fn = compile<string>(qjs, '' + aPlusB, 'aPlusB', {
				sandbox: { a, b },
			});
			const val = await fn();
			assert.equal(val, 'ab');
		});
		it('should throw an Error if no function is returned from the `vm`', async () => {
			let err: Error | undefined;
			try {
				compile<() => Promise<string>>(qjs, 'const foo = 1', 'foo');
			} catch (_err) {
				err = _err as Error;
			}
			assert(err);
			assert.equal(
				err.message,
				'Expected a "function" named `foo` to be defined, but got "number"'
			);
		});
		it('should compile if branches', async () => {
			function ifA(): string {
				if (a()) {
					return 'foo';
				}
				return 'bar';
			}
			function a() {
				if (b()) {
					return false;
				}
				return true;
			}
			function b() {
				return false;
			}
			const fn = compile<string>(qjs, `${ifA};${a}`, 'ifA', {
				names: ['b'],
				sandbox: { b },
			});
			const val = await fn();
			assert.equal(val, 'foo');
		});
		it('should prevent privilege escalation of untrusted code', async () => {
			let err: Error | undefined;
			try {
				const fn = compile<typeof process>(
					qjs,
					`const f = this.constructor.constructor('return process');`,
					'f'
				);
				await fn();
			} catch (_err) {
				err = _err as Error;
			}
			assert(err);
			assert.equal(err.message, "'process' is not defined");
		});
		it('should allow to return synchronous undefined', async () => {
			function u() {
				// empty
			}
			const fn = compile(qjs, `${u}`, 'u');
			const val = await fn();
			assert.strictEqual(typeof val, 'undefined');
		});
		it('should support "filename" option', async () => {
			function u() {
				throw new Error('fail');
			}
			let err: Error | undefined;
			const fn = compile(qjs, `${u}`, 'u', {
				filename: '/foo/bar/baz.js',
			});
			try {
				await fn();
			} catch (_err) {
				err = _err as Error;
			}
			assert(err);
			assert.strictEqual(err.message, 'fail');
			assert(err.stack?.includes('at u (/foo/bar/baz.js:'));
		});
	});
});
