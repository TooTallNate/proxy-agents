import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		testTimeout: 10000,
		include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)', '**/test/test.[jt]s?(x)'],
		exclude: ['**/node_modules/**', '**/.git/**', '**/e2e.test.*'],
	},
});
