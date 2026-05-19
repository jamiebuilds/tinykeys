import js from "@eslint/js"
import { defineConfig, globalIgnores } from "eslint/config"
import tseslint from "typescript-eslint"

export default defineConfig(
	js.configs.recommended,
	tseslint.configs.recommended,
	tseslint.configs.recommendedTypeChecked,
	tseslint.configs.strict,
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
			},
		},
	},
	globalIgnores(["dist", "example/dist"]),
	{
		rules: {
			"prefer-const": "off",
			"no-undef": "off",
		},
	},
)
