import { types } from 'util';
import { degenerator } from './degenerator';
import type { Context } from 'vm';
import type {
	QuickJSContext,
	QuickJSHandle,
	QuickJSWASMModule,
} from '@tootallnate/quickjs-emscripten';
import type { DegeneratorNames } from './degenerator';

export interface CompileOptions {
	names?: DegeneratorNames;
	filename?: string;
	sandbox?: Context;
}

export function compile<R = unknown, A extends unknown[] = []>(
	qjs: QuickJSWASMModule,
	code: string,
	returnName: string,
	options: CompileOptions = {}
): (...args: A) => Promise<R> {
	const compiled = degenerator(code, options.names ?? []);

	const vm = qjs.newContext();

	// Add functions to global
	if (options.sandbox) {
		for (const [name, value] of Object.entries(options.sandbox)) {
			if (typeof value !== 'function') {
				throw new Error(
					`Expected a "function" for sandbox property \`${name}\`, but got "${typeof value}"`
				);
			}
			const fnHandle = vm.newFunction(name, (...args) => {
				const result = value(
					...args.map((arg) => quickJSHandleToHost(vm, arg))
				);
				vm.runtime.executePendingJobs();
				return hostToQuickJSHandle(vm, result);
			});
			fnHandle.consume((handle) => vm.setProp(vm.global, name, handle));
		}
	}

	const fnResult = vm.evalCode(`${compiled};${returnName}`, options.filename);
	const fn = vm.unwrapResult(fnResult);

	const t = vm.typeof(fn);
	if (t !== 'function') {
		throw new Error(
			`Expected a "function" named \`${returnName}\` to be defined, but got "${t}"`
		);
	}
	const r = async function (...args: A): Promise<R> {
		let promiseHandle: QuickJSHandle | undefined;
		let resolvedHandle: QuickJSHandle | undefined;
		try {
			const result = vm.callFunction(
				fn,
				vm.undefined,
				...args.map((arg) => hostToQuickJSHandle(vm, arg))
			);
			promiseHandle = vm.unwrapResult(result);
			const resolvedResultP = vm.resolvePromise(promiseHandle);
			vm.runtime.executePendingJobs();
			const resolvedResult = await resolvedResultP;
			resolvedHandle = vm.unwrapResult(resolvedResult);
			return quickJSHandleToHost(vm, resolvedHandle);
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

function quickJSHandleToHost(vm: QuickJSContext, val: QuickJSHandle) {
	return vm.dump(val);
}

function hostToQuickJSHandle(vm: QuickJSContext, val: unknown): QuickJSHandle {
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
		promise.settled.then(vm.runtime.executePendingJobs);
		val.then(
			(r: unknown) => {
				promise.resolve(hostToQuickJSHandle(vm, r));
			},
			(err: unknown) => {
				promise.reject(hostToQuickJSHandle(vm, err));
			}
		);
		return promise.handle;
	} else if (types.isNativeError(val)) {
		return vm.newError(val);
	}
	throw new Error(`Unsupported value: ${val}`);
}
