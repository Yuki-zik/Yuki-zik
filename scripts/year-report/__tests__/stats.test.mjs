import test from "node:test"
import assert from "node:assert/strict"

import { deriveYearlyStatistics } from "../stats.mjs"
import { getTimeZoneDateRangeIso } from "../utils.mjs"

function toIsoDate(date) {
  return date.toISOString().slice(0, 10)
}

function getContributionLevel(count) {
  if (count <= 0) {
    return "NONE"
  }

  if (count <= 2) {
    return "FIRST_QUARTILE"
  }

  if (count <= 4) {
    return "SECOND_QUARTILE"
  }

  if (count <= 7) {
    return "THIRD_QUARTILE"
  }

  return "FOURTH_QUARTILE"
}

function buildCalendar(year, dayCounts = {}) {
  const days = []
  let cursor = new Date(Date.UTC(year, 0, 1))
  const end = new Date(Date.UTC(year, 11, 31))

  while (cursor <= end) {
    const isoDate = toIsoDate(cursor)
    const count = dayCounts[isoDate] ?? 0

    days.push({
      contributionCount: count,
      contributionLevel: getContributionLevel(count),
      date: isoDate,
      weekday: cursor.getUTCDay(),
    })

    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  }

  const weeks = []
  for (let idx = 0; idx < days.length; idx += 7) {
    weeks.push({ contributionDays: days.slice(idx, idx + 7) })
  }

  return { weeks }
}

test("zero contribution year", () => {
  const year = 2025
  const calendar = buildCalendar(year)

  const stats = deriveYearlyStatistics(calendar, {
    year,
    timeZone: "UTC",
    now: new Date("2026-02-01T00:00:00Z"),
  })

  assert.equal(stats.totalContributions, 0)
  assert.equal(stats.averageContributionsPerDay, 0)
  assert.equal(stats.longestStreak, 0)
  assert.equal(stats.longestGap, 365)
  assert.equal(stats.totalDaysConsidered, 365)
})

test("leap year has 366 considered days", () => {
  const year = 2024
  const dayCounts = {}

  let cursor = new Date(Date.UTC(2024, 0, 1))
  const end = new Date(Date.UTC(2024, 11, 31))
  while (cursor <= end) {
    dayCounts[toIsoDate(cursor)] = 1
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  }

  const calendar = buildCalendar(year, dayCounts)

  const stats = deriveYearlyStatistics(calendar, {
    year,
    timeZone: "UTC",
    now: new Date("2026-01-01T00:00:00Z"),
  })

  assert.equal(stats.totalDaysConsidered, 366)
  assert.equal(stats.totalContributions, 366)
  assert.equal(stats.longestStreak, 366)
})

test("longest streak can cross months", () => {
  const year = 2025
  const calendar = buildCalendar(year, {
    "2025-01-30": 1,
    "2025-01-31": 1,
    "2025-02-01": 1,
    "2025-02-02": 1,
    "2025-02-03": 1,
  })

  const stats = deriveYearlyStatistics(calendar, {
    year,
    timeZone: "UTC",
    now: new Date("2026-01-01T00:00:00Z"),
  })

  assert.equal(stats.longestStreak, 5)
  assert.equal(stats.longestStreakStartDate, "2025-01-30")
  assert.equal(stats.longestStreakEndDate, "2025-02-03")
  assert.equal(stats.maxContributionsMonth, "2025-02")
})

test("future days in current year are ignored", () => {
  const year = 2026
  const calendar = buildCalendar(year, {
    "2026-01-01": 1,
    "2026-12-31": 10,
  })

  const stats = deriveYearlyStatistics(calendar, {
    year,
    timeZone: "UTC",
    now: new Date("2026-01-10T00:00:00Z"),
  })

  assert.equal(stats.totalContributions, 1)
  assert.equal(stats.longestGap, 9)
  assert.equal(stats.longestGapStartDate, "2026-01-02")
  assert.equal(stats.longestGapEndDate, "2026-01-10")
  assert.equal(stats.maxContributionsInADay, 1)
  assert.equal(stats.maxContributionsDate, "2026-01-01")
})

test("decimal precision and active days", () => {
  const year = 2025
  const dayCounts = {}
  let cursor = new Date(Date.UTC(year, 0, 1))
  for (let i = 0; i < 100; i++) {
    dayCounts[toIsoDate(cursor)] = 1
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  }

  const calendar = buildCalendar(year, dayCounts)
  const stats = deriveYearlyStatistics(calendar, {
    year,
    timeZone: "UTC",
    now: new Date("2026-01-01T00:00:00Z"),
  })

  assert.equal(stats.totalContributions, 100)
  assert.equal(stats.activeDays, 100)
  assert.equal(stats.averageContributionsPerDay, 0.3)
})

test("rolling month buckets do not merge same month across different years", () => {
  const calendar = {
    weeks: [
      {
        contributionDays: [
          { contributionCount: 5, contributionLevel: "SECOND_QUARTILE", date: "2025-05-20", weekday: 2 },
          { contributionCount: 3, contributionLevel: "FIRST_QUARTILE", date: "2025-06-01", weekday: 0 },
          { contributionCount: 10, contributionLevel: "FOURTH_QUARTILE", date: "2026-05-01", weekday: 5 },
        ],
      },
    ],
  }

  const stats = deriveYearlyStatistics(calendar, {
    year: 2026,
    timeZone: "UTC",
    now: new Date("2026-05-17T00:00:00Z"),
    dateRange: { start: "2025-05-18", end: "2026-05-17" },
  })

  assert.equal(stats.totalContributions, 18)
  assert.equal(stats.monthlyContributions.length, 13)
  assert.equal(stats.monthlyLabels[0], "25/5月")
  assert.equal(stats.monthlyLabels[12], "26/5月")
  assert.equal(stats.monthlyContributions[0], 5)
  assert.equal(stats.monthlyContributions[1], 3)
  assert.equal(stats.monthlyContributions[12], 10)
  assert.equal(stats.maxContributionsMonth, "2026-05")
})

test("time zone date range uses local day boundaries", () => {
  const range = getTimeZoneDateRangeIso({
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    timeZone: "Asia/Shanghai",
  })

  assert.equal(range.from, "2025-12-31T16:00:00.000Z")
  assert.equal(range.to, "2026-12-31T15:59:59.999Z")
})
