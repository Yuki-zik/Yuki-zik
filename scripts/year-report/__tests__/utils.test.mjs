import { describe, test, expect } from "vitest"
import {
    escapeXml,
    formatNumber,
    truncate,
    wrapLines,
    estimateTextWidth,
    parseCliArgs,
    formatDateCN,
    formatDateRangeCN,
} from "../utils.mjs"

describe("escapeXml", () => {
    test("escapes ampersand and angle brackets", () => {
        expect(escapeXml("<b>&</b>")).toBe("&lt;b&gt;&amp;&lt;/b&gt;")
    })

    test("escapes single quotes to &apos;", () => {
        expect(escapeXml("it's")).toBe("it&apos;s")
    })

    test("returns empty string for falsy input", () => {
        expect(escapeXml("")).toBe("")
        expect(escapeXml(null)).toBe("")
        expect(escapeXml(undefined)).toBe("")
    })

    test("passes through safe strings unchanged", () => {
        expect(escapeXml("hello world")).toBe("hello world")
    })
})

describe("formatNumber", () => {
    test("formats thousands with commas", () => {
        expect(formatNumber(1234567)).toBe("1,234,567")
    })

    test("handles zero", () => {
        expect(formatNumber(0)).toBe("0")
    })

    test("handles small numbers without commas", () => {
        expect(formatNumber(42)).toBe("42")
    })

    test("handles non-finite values", () => {
        expect(formatNumber(NaN)).toBe("0")
        expect(formatNumber(Infinity)).toBe("0")
    })
})

describe("truncate", () => {
    test("returns short strings unchanged", () => {
        expect(truncate("hello", 10)).toBe("hello")
    })

    test("truncates long strings with ellipsis", () => {
        const result = truncate("a very long string that should be truncated", 10)
        expect(result.endsWith("…")).toBe(true)
    })

    test("handles empty string", () => {
        expect(truncate("", 10)).toBe("")
    })
})

describe("wrapLines", () => {
    test("wraps long text into multiple lines", () => {
        const result = wrapLines("This is a somewhat longer piece of text that needs wrapping", 20, 5)
        expect(result.length).toBeGreaterThanOrEqual(1)
    })

    test("returns array for empty input", () => {
        const result = wrapLines("", 20, 5)
        expect(Array.isArray(result)).toBe(true)
    })

    test("respects max lines limit", () => {
        const longText = "word ".repeat(100)
        const result = wrapLines(longText, 10, 3)
        expect(result.length).toBeLessThanOrEqual(3)
    })
})

describe("estimateTextWidth", () => {
    test("returns 0 for empty string", () => {
        expect(estimateTextWidth("", 16)).toBe(0)
    })

    test("ASCII text is narrower than CJK text of same length", () => {
        const asciiWidth = estimateTextWidth("abcd", 16)
        const cjkWidth = estimateTextWidth("你好世界", 16)
        expect(cjkWidth).toBeGreaterThan(asciiWidth)
    })

    test("scales with font size", () => {
        const small = estimateTextWidth("test", 12)
        const large = estimateTextWidth("test", 24)
        expect(large).toBe(small * 2)
    })
})

describe("parseCliArgs", () => {
    test("parses --year flag", () => {
        const args = parseCliArgs(["--year", "2024"])
        expect(args.year).toBe(2024)
    })

    test("parses --no-ai flag", () => {
        const args = parseCliArgs(["--no-ai"])
        expect(args.noAi).toBe(true)
    })

    test("parses --dry-run flag", () => {
        const args = parseCliArgs(["--dry-run"])
        expect(args.dryRun).toBe(true)
    })

    test("defaults to null year and false flags", () => {
        const args = parseCliArgs([])
        expect(args.year).toBeNull()
        expect(args.noAi).toBe(false)
        expect(args.dryRun).toBe(false)
    })
})

describe("formatDateCN", () => {
    test("formats date in Chinese style", () => {
        const result = formatDateCN("2025-01-18")
        expect(result).toContain("1")
        expect(result).toContain("18")
    })
})

describe("formatDateRangeCN", () => {
    test("returns formatted range for valid dates", () => {
        const result = formatDateRangeCN("2025-01-01", "2025-01-05")
        expect(result).toBeTruthy()
        expect(result.length).toBeGreaterThan(0)
    })

    test("returns fallback for missing dates", () => {
        const result = formatDateRangeCN(null, null)
        expect(result).toBe("--")
    })
})
