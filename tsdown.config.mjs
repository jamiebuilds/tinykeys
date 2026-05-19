import { defineConfig } from "tsdown"

export default defineConfig({
	entry: "src/tinykeys.ts",
	outDir: "dist",
	outputOptions: {
		name: "tinykeys",
	},
	dts: true,
	sourcemap: true,
	format: {
		esm: {},
		cjs: {},
		umd: { minify: true },
	},
	publint: true,
	attw: true,
})
