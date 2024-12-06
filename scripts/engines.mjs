import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import subset from 'semver/ranges/subset.js';
import { relative } from 'node:path';

const ENGINES = '>=14';

const getAllProdDeps = async () => {
	const deps = new Set();
	const walk = (dep) => {
		if (dep.private) return;
		if (dep.path) {
			deps.add(dep.path);
		}
		const children = Array.isArray(dep)
			? dep
			: Object.values(dep.dependencies ?? {});
		for (const child of children) {
			walk(child);
		}
	};
	const workspaces = await new Promise((res, rej) => {
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
	});
	for (const ws of workspaces) {
		walk(ws);
	}
	return [...deps].map((path) => ({
		path,
		pkg: JSON.parse(readFileSync(resolve(path, 'package.json'), 'utf8')),
	}));
};

const check = (key, packages, value, ok) => {
	const problems = packages.filter((p) => !ok(value(p)));
	if (problems.length) {
		return [
			`The following dependencies ${key} problems were found:`,
			...problems.map((p) =>
				[
					`${p.pkg.name}@${p.pkg.version}`,
					`  ${key}: ${value(p)}`,
					`  path: ${relative(process.cwd(), p.path)}/package.json`,
				].join('\n')
			),
		].join('\n\n');
	}
};

const main = async () => {
	const deps = await getAllProdDeps();
	const checkEngines = check(
		'engines',
		deps,
		(d) => d.pkg.engines?.node,
		(v) => v === undefined || subset(ENGINES, v)
	);
	if (checkEngines) {
		throw new Error(checkEngines);
	}
	return (
		`Successfully checked ${deps.length} production dependencies:\n` +
		deps
			.map((d) => `${d.pkg.name}@${d.pkg.version} `)
			.sort()
			.join('\n')
	);
};

main()
	.then(console.log)
	.catch((e) => {
		process.exitCode = 1;
		console.error(e.message);
	});
