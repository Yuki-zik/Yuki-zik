import { describe, test, expect } from "vitest"
import { deriveYearlyStatistics } from "../stats.mjs"

describe("Rolling Stats Logic", () => {
    const calendar = {
        weeks: [
            {
                days: [
                    { date: "2024-12-31", count: 5, weekday: 2 },
                    { date: "2025-01-01", count: 10, weekday: 3 },
                    { date: "2025-01-02", count: 0, weekday: 4 },
                    { date: "2026-01-01", count: 8, weekday: 4 }, // Future date relative to range
                ],
            },
        ],
    }

    const options = {
        year: 2025,
        timeZone: "UTC",
        now: new Date("2025-02-01T00:00:00Z"),
    }

    test("uses dateRange to filter contributions across years", () => {
        const stats = deriveYearlyStatistics(calendar, {
            ...options,
            dateRange: { start: "2024-12-31", end: "2025-01-01" },
        })

        // Should include 2024-12-31 (5) and 2025-01-01 (10)
        // 2025-01-02 is clearly outside range? Wait, range end is inclusive?
        // My implementation uses <= end.
        // 2025-01-01 <= 2025-01-01 is true.
        expect(stats.totalContributions).toBe(15)
        expect(stats.totalDaysConsidered).toBe(2)
    })

    test("excludes dates outside dateRange", () => {
        const stats = deriveYearlyStatistics(calendar, {
            ...options,
            dateRange: { start: "2025-01-01", end: "2025-01-01" },
        })

        expect(stats.totalContributions).toBe(10)
        expect(stats.totalDaysConsidered).toBe(1)
    })

    test("defaults to year logic if no dateRange", () => {
        // Falls back to year 2025 filtering
        // 2024-12-31 excluded (diff year)
        // 2025-01-01 included
        // 2025-01-02 included
        // 2026-01-01 excluded
        const stats = deriveYearlyStatistics(calendar, {
            ...options,
            dateRange: null
        })

        expect(stats.totalContributions).toBe(10) // 10 + 0
        expect(stats.totalDaysConsidered).toBe(2)
    })
})
