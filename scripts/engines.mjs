import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import subset from 'semver/ranges/subset.js';
import { relative, join } from 'node:path';

/**
 * An object containing validation checks for package properties.
 *
 * @constant
 * @type {Object}
 * @property {Object} engines - Validation check for the "engines" property.
 * @property {string} engines.wanted - The desired version range for Node.js engines.
 * @property {string} engines.title - The title describing the engines check.
 * @property {Function} engines.getValue - Function to get the Node.js engine version from the package.
 * @property {Function} engines.isOK - Function to check if the Node.js engine version is acceptable.
 *
 * @property {Object} licenses - Validation check for the "license" property.
 * @property {string[]} licenses.wanted - The list of acceptable licenses.
 * @property {string} licenses.title - The title describing the license check.
 * @property {Function} licenses.getValue - Function to get the license from the package.
 * @property {Function} licenses.isOK - Function to check if the license is acceptable.
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
 * Asynchronously retrieves a sorted list of production dependencies for the current project.
 *
 * This function uses `pnpm` to list all production dependencies recursively and then processes
 * the output to create an array of dependency objects. Each object contains the path to the
 * package.json file, the relative path from the current working directory, and the parsed
 * package.json content.
 *
 * @constant {Promise<Array<{path: string, relPath: string, pkg: Object}>>>} DEPS - A promise that resolves to an array of dependency objects.
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

const problems = (
	Object.hasOwn(CHECKS, process.argv[2])
		? [CHECKS[process.argv[2]]]
		: Object.values(CHECKS)
)
	.map((check) => {
		const problems = DEPS.filter(
			(dep) => !check.isOK(check.getValue(dep.pkg))
		);
		if (!problems.length) return null;
		return { deps: problems, problem: check };
	})
	.filter((v) => v !== null);

if (problems.length) {
	for (const { deps, problem } of problems) {
		console.group(problem.title);
		for (const { pkg, relPath } of deps) {
			console.group(`${pkg.name}@${pkg.version}`);
			console.log(`found: "${problem.getValue(pkg)}"`);
			console.log(relPath);
			console.groupEnd();
		}
		console.groupEnd();
		console.log('');
	}
	console.log('not ok');
	process.exit(1);
}

for (const { pkg, relPath } of DEPS) {
	console.group(`${pkg.name}@${pkg.version}`);
	console.log(relPath);
	console.groupEnd();
}
console.log('');
console.log('ok');
