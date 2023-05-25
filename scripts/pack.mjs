import { join } from 'path';
import { spawnSync } from 'child_process';
import {
	readFileSync,
	writeFileSync,
	readdirSync,
	mkdirSync,
	renameSync,
} from 'fs';

// eslint-disable-next-line turbo/no-undeclared-env-vars
const { VERCEL_URL } = process.env;

const cwd = process.cwd();
const publicDir = new URL('../public/', import.meta.url);
mkdirSync(publicDir, { recursive: true });

const packages = readdirSync(join(cwd, '..'));
const pkgPath = join(cwd, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath));
if (pkg.dependencies) {
	for (const dep of Object.keys(pkg.dependencies)) {
		if (packages.includes(dep)) {
			// This dep is one of the ones within the monorepo,
			// so update to use a tarball URL
			pkg.dependencies[dep] = `https://${VERCEL_URL}/${dep}.tgz`;
		}
	}
}
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
spawnSync('pnpm', ['pack']);

const tarball = readdirSync(cwd).find((f) => f.endsWith('.tgz'));
const dest = new URL(`${pkg.name}.tgz`, publicDir);
renameSync(join(cwd, tarball), dest);
