import 'zx/globals';

const sha = process.argv[2] || process.env.GITHUB_SHA || 'HEAD';

try {
	const modifiedPackages =
		await $`git show ${sha} --pretty="format:" --name-only -- packages/*/package.json`;

	const packageJsonPaths = modifiedPackages.stdout.trim().split('\n');

	const packageJsons = await Promise.all(
		packageJsonPaths.map((p) => fs.readJson(p))
	);

	for (const packageJson of packageJsons) {
		const tag = `${packageJson.name}@${packageJson.version}`;
		//await $`git tag ${tag}`;
		console.log({ tag });
	}
} catch {
	console.log('No tags need to be created');
}
