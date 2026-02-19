import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        include: [
            "scripts/year-report/__tests__/utils.test.mjs",
            "scripts/year-report/__tests__/ai-summary.test.mjs",
            "scripts/year-report/__tests__/stats.rolling.test.mjs",
        ],
    },
})
