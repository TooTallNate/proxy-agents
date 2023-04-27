module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	plugins: ['@typescript-eslint'],
	env: {
		node: true,
	},
	// This tells ESLint to load the config from the package `eslint-config-custom`
	extends: [
		'turbo',
		'prettier',
		'eslint:recommended',
		'plugin:@typescript-eslint/eslint-recommended',
		'plugin:@typescript-eslint/recommended',
	],
};
