import { types } from 'util';
import { degenerator } from './degenerator.js';
import type { Context } from 'vm';
import type { QuickJS, JSValueHandle } from 'quickjs-wasi';
import type { DegeneratorNames } from './degenerator.js';

export interface CompileOptions {
	names?: DegeneratorNames;
	filename?: string;
	sandbox?: Context;
}

const SANDBOX_FUNCTION_PREFIX = '__degeneratorSandboxFunction:';

export function compile<R = unknown, A extends unknown[] = []>(
	vm: QuickJS,
	code: string,
	returnName: string,
	options: CompileOptions = {}
): (...args: A) => Promise<R> {
	const compiled = degenerator(code, options.names ?? []);

	// Add functions to global
	if (options.sandbox) {
		for (const [name, value] of Object.entries(options.sandbox)) {
			if (typeof value !== 'function') {
				throw new Error(
					`Expected a "function" for sandbox property \`${name}\`, but got "${typeof value}"`
				);
			}
			const fnHandle = getOrCreateSandboxFunction(vm, name, value);
			fnHandle.consume((handle) => vm.setProp(vm.global, name, handle));
		}
	}

	const fn = vm.evalCode(`${compiled};${returnName}`, options.filename);

	const t = vm.typeof(fn);
	if (t !== 'function') {
		throw new Error(
			`Expected a "function" named \`${returnName}\` to be defined, but got "${t}"`
		);
	}
	const r = async function (...args: A): Promise<R> {
		let promiseHandle: JSValueHandle | undefined;
		let resolvedHandle: JSValueHandle | undefined;
		try {
			const result = vm.callFunction(
				fn,
				vm.undefined,
				...args.map((arg) => hostToQuickJSHandle(vm, arg))
			);
			promiseHandle = result;
			const resolvedResultP = vm.resolvePromise(promiseHandle);
			vm.executePendingJobs();
			const resolvedResult = await resolvedResultP;
			if ('error' in resolvedResult) {
				const dumped = vm.dump(resolvedResult.error);
				resolvedResult.error.dispose();
				if (dumped instanceof Error) {
					// QuickJS Error `stack` does not include the name +
					// message, so patch those in to behave more like V8
					if (dumped.stack && !dumped.stack.startsWith(dumped.name)) {
						dumped.stack = `${dumped.name}: ${dumped.message}\n${dumped.stack}`;
					}
					throw dumped;
				}
				throw new Error(String(dumped));
			}
			resolvedHandle = resolvedResult.value;
			return vm.dump(resolvedHandle) as R;
		} catch (err: unknown) {
			if (err && typeof err === 'object' && 'cause' in err && err.cause) {
				if (
					typeof err.cause === 'object' &&
					'stack' in err.cause &&
					'name' in err.cause &&
					'message' in err.cause &&
					typeof err.cause.stack === 'string' &&
					typeof err.cause.name === 'string' &&
					typeof err.cause.message === 'string'
				) {
					// QuickJS Error `stack` does not include the name +
					// message, so patch those in to behave more like V8
					err.cause.stack = `${err.cause.name}: ${err.cause.message}\n${err.cause.stack}`;
				}
				throw err.cause;
			}
			throw err;
		} finally {
			promiseHandle?.dispose();
			resolvedHandle?.dispose();
		}
	};
	Object.defineProperty(r, 'toString', {
		value: () => compiled,
		enumerable: false,
	});
	return r;
}

function getOrCreateSandboxFunction(
	vm: QuickJS,
	name: string,
	value: (...args: unknown[]) => unknown
): JSValueHandle {
	const callback = (...args: JSValueHandle[]) => {
		const result = value(...args.map((arg) => vm.dump(arg)));
		vm.executePendingJobs();
		return hostToQuickJSHandle(vm, result);
	};

	const globalFunctionName = `${SANDBOX_FUNCTION_PREFIX}${name}`;
	const keyHandle = vm.newString(globalFunctionName);
	let existingHandle: JSValueHandle | undefined;
	try {
		existingHandle = vm.getProp(vm.global, keyHandle);
		if (vm.typeof(existingHandle) === 'function') {
			vm.registerHostCallback(name, callback);
			return existingHandle;
		}
		existingHandle.dispose();
		existingHandle = undefined;

		const fnHandle = vm.newFunction(name, callback);
		vm.defineProp(vm.global, globalFunctionName, fnHandle, {
			writable: false,
			enumerable: false,
			configurable: false,
		});
		return fnHandle;
	} finally {
		keyHandle.dispose();
	}
}

function hostToQuickJSHandle(vm: QuickJS, val: unknown): JSValueHandle {
	if (typeof val === 'undefined') {
		return vm.undefined;
	} else if (val === null) {
		return vm.null;
	} else if (typeof val === 'string') {
		return vm.newString(val);
	} else if (typeof val === 'number') {
		return vm.newNumber(val);
	} else if (typeof val === 'bigint') {
		return vm.newBigInt(val);
	} else if (typeof val === 'boolean') {
		return val ? vm.true : vm.false;
	} else if (types.isPromise(val)) {
		const promise = vm.newPromise();
		val.then(
			(r: unknown) => {
				promise.resolve(hostToQuickJSHandle(vm, r));
				vm.executePendingJobs();
			},
			(err: unknown) => {
				promise.reject(hostToQuickJSHandle(vm, err));
				vm.executePendingJobs();
			}
		);
		return promise.handle;
	} else if (types.isNativeError(val)) {
		return vm.newError(val);
	}
	throw new Error(`Unsupported value: ${val}`);
}
