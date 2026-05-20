import { defineConfig } from "vitest/config"
import { playwright } from "@vitest/browser-playwright"

export default defineConfig({
	test: {
		clearMocks: true,
		browser: {
			provider: playwright(),
			enabled: true,
			headless: true,
			instances: [{ browser: "chromium" }],
		},
	},
})
