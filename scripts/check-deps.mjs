import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import subset from 'semver/ranges/subset.js';
import { relative, join } from 'node:path';
import assert from 'node:assert';

/**
 * An object containing validation checks for package properties.
 *
 * @property {Object} engines - Validation check for the "engines" property.
 * @property {Object} licenses - Validation check for the "license" property.
 */
const CHECKS = {
	engines: {
		wanted: '>=14',
		get title() {
			return `Engines must be a subset of "${this.wanted}"`;
		},
		getValue(pkg) {
			return pkg.engines?.node;
		},
		isOK(value) {
			return value === undefined || subset(this.wanted, value);
		},
	},
	licenses: {
		wanted: [
			'0BSD',
			'BlueOak-1.0.0',
			'BSD-2-Clause',
			'BSD-3-Clause',
			'ISC',
			'MIT',
		],
		get title() {
			return `License must be one of the following: "${this.wanted.join(
				', '
			)}"`;
		},
		getValue(pkg) {
			return pkg.license;
		},
		isOK(value) {
			return value === undefined || this.wanted.includes(value);
		},
	},
};

/**
 * Retrieves a sorted list of production dependencies for the current project.
 *
 * This function uses `pnpm` to list all production dependencies recursively and then processes
 * the output to create an array of dependency objects. Each object contains the path to the
 * package.json file, the relative path from the current working directory, and the parsed
 * package.json content.
 *
 * Each dependency object has the following properties:
 * - `path` {string}: The absolute path to the package.json file.
 * - `relPath` {string}: The relative path from the current working directory to the package.json file.
 * - `pkg` {Object}: The parsed content of the package.json file.
 */
const DEPS = await (async () => {
	const pkgs = new Set();

	const walk = (dep) => {
		if (dep.private) return;
		if (dep.path) pkgs.add(join(dep.path, 'package.json'));
		for (const child of Array.isArray(dep)
			? dep
			: Object.values(dep.dependencies ?? {})) {
			walk(child);
		}
	};

	walk(
		await new Promise((res, rej) => {
			const proc = spawn(
				'pnpm',
				['list', '--recursive', '--depth=Infinity', '--json', '--prod'],
				{
					cwd: process.cwd(),
					shell: true,
				}
			);
			let output = '';
			proc.stdout.on('data', (data) => (output += data.toString()));
			proc.on('close', () => res(JSON.parse(output))).on('error', rej);
		})
	);

	return [...pkgs]
		.map((path) => ({
			path,
			relPath: relative(process.cwd(), path),
			pkg: JSON.parse(readFileSync(path, 'utf8')),
		}))
		.sort((a, b) => a.pkg.name.localeCompare(b.pkg.name, 'en'));
})();

const main = (key) => {
	let checksNotOk = 0;

	assert(
		!key || Object.hasOwn(CHECKS, key),
		new TypeError('arg must be a valid check', {
			cause: { found: key, wanted: Object.keys(CHECKS) },
		})
	);

	const checks = Object.hasOwn(CHECKS, key)
		? [CHECKS[key]]
		: Object.values(CHECKS);

	for (const check of checks) {
		let depsNotOk = 0;
		console.group(check.title);

		for (const { pkg, relPath } of DEPS) {
			if (check.isOK(check.getValue(pkg))) continue;
			depsNotOk++;
			console.group(`${pkg.name}@${pkg.version}`);
			console.log(`found: "${check.getValue(pkg)}"`);
			console.log(relPath);
			console.groupEnd();
		}

		if (depsNotOk) {
			checksNotOk += 1;
			console.log(`not ok (${depsNotOk} failed of ${DEPS.length} deps)`);
		} else {
			console.log(`ok (${DEPS.length} dependencies checked)`);
		}

		console.groupEnd();
	}

	console.log('');

	if (checksNotOk) {
		process.exitCode = 1;
		console.log(
			`not ok (${checksNotOk} failed of ${checks.length} checks)`
		);
	} else {
		console.log(`ok`);
	}
};

main(process.argv[2]);
