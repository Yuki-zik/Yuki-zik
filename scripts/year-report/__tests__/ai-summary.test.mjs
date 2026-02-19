import { describe, test, expect, vi } from "vitest"
import { generateAiSummary } from "../ai-summary.mjs"

describe("generateAiSummary", () => {
    const baseOptions = {
        enabled: true,
        apiKey: "test-key",
        baseUrl: "https://api.example.com/v1",
        model: "gpt-4",
        username: "testuser",
        year: 2025,
        stats: {
            totalContributions: 100,
            averageContributionsPerDay: 0.3,
            longestStreak: 5,
            longestGap: 10,
            maxContributionsMonth: "2025-12",
            maxContributionsInADay: 15,
            maxContributionsDate: "2025-12-22",
        },
        issuesCount: 2,
        prCount: 3,
        topLanguages: [{ name: "JavaScript", percent: 50 }],
        topRepos: [{ nameWithOwner: "user/repo", commits: 10 }],
    }

    test("returns fallback when disabled", async () => {
        const result = await generateAiSummary({ ...baseOptions, enabled: false })
        expect(result.mode).toBe("fallback")
        expect(result.intro).toBeTruthy()
        expect(result.sections).toBeInstanceOf(Array)
        expect(result.sections.length).toBe(3)
    })

    test("returns fallback when apiKey is missing", async () => {
        const result = await generateAiSummary({ ...baseOptions, apiKey: "" })
        expect(result.mode).toBe("fallback")
        expect(result.reason).toContain("OPENAI_API_KEY")
    })

    test("returns fallback when fetch fails", async () => {
        const originalFetch = globalThis.fetch
        globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"))

        const result = await generateAiSummary(baseOptions)
        expect(result.mode).toBe("fallback")
        expect(result.reason).toBeTruthy()

        globalThis.fetch = originalFetch
    })

    test("returns fallback when API returns non-200", async () => {
        const originalFetch = globalThis.fetch
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            text: async () => "Internal Server Error",
        })

        const result = await generateAiSummary(baseOptions)
        expect(result.mode).toBe("fallback")

        globalThis.fetch = originalFetch
    })

    test("returns fallback when API returns invalid JSON content", async () => {
        const originalFetch = globalThis.fetch
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: "not valid json" } }],
            }),
        })

        const result = await generateAiSummary(baseOptions)
        expect(result.mode).toBe("fallback")

        globalThis.fetch = originalFetch
    })

    test("returns AI result when API returns valid JSON", async () => {
        const aiResponse = {
            intro: "Great year!",
            sections: [
                { heading: "Overview", content: "Lots of work" },
                { heading: "Rhythm", content: "Consistent" },
                { heading: "Tech", content: "JavaScript" },
            ],
        }

        const originalFetch = globalThis.fetch
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: JSON.stringify(aiResponse) } }],
            }),
        })

        const result = await generateAiSummary(baseOptions)
        expect(result.mode).toBe("ai")
        expect(result.intro).toBe("Great year!")
        expect(result.sections).toHaveLength(3)

        globalThis.fetch = originalFetch
    })

    test("fallback summary includes sections with headings and content", async () => {
        const result = await generateAiSummary({ ...baseOptions, enabled: false })
        result.sections.forEach((section) => {
            expect(section).toHaveProperty("heading")
            expect(section).toHaveProperty("content")
            expect(section.heading.length).toBeGreaterThan(0)
            expect(section.content.length).toBeGreaterThan(0)
        })
    })
})
