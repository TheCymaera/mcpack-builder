import typescript from '@rollup/plugin-typescript'

export default {
	input: './src/mod.ts',
	output: {
		format: 'esm',
		file: 'dst/mod.js',
	},
	plugins: [
		typescript(),
	],
}