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
	overrides: [
		{
			files: ['packages/{pac-proxy,proxy,socks-proxy}-agent/**/*'],
			rules: {
				'no-restricted-globals': [
					'error',
					// https://github.com/TooTallNate/proxy-agents/pull/242
					{
						name: 'URL',
						message:
							'Use `URL` from the Node.js "url" module instead.',
					},
				],
			},
		},
	],
};
