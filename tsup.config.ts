import {defineConfig} from 'tsup';

export default defineConfig({
	entry: ['src/cli.tsx'],
	format: ['esm'],
	sourcemap: true,
	clean: true,
	dts: true,
	splitting: false,
	minify: false,
	banner: {
		js: '#!/usr/bin/env node',
	},
});

